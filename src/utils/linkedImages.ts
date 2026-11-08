/**
 * Keeps the XML that is written to disk free of embedded image data.
 *
 * Draw.io stores images in the `image=` part of a cell's style. When an image
 * is dropped or pasted, draw.io writes a `data:image/png,<base64>` value into
 * that style (its "short" data URI form, see `EditorUi.convertDataUri`). That
 * is what makes git diffs unreadable.
 *
 * This module converts between two representations of the same diagram:
 * - On disk: `image=./assets/diagram.png` (relative to the diagram file).
 * - In the editor: a short data URI, which is the only form that renders in
 *   the webview (the webview's `<base>` points at the bundled draw.io app, so a
 *   relative path would be resolved against that folder).
 *
 * The mapping is keyed by the image content, so it is stable across reloads
 * and never writes a machine-specific or webview-specific URI into the file.
 * This extension never creates image files: images must already exist in the
 * workspace. A data URI with no known reference is left as it is, rather than
 * being written to a generated directory.
 * Images that are not relative paths (http links, other data URIs that draw.io
 * uses for inline SVG, ...) are left untouched.
 */

export interface LinkedImageData {
	/** e.g. `image/png`. */
	mime: string;
	/** Base64 encoded bytes, without the `data:` prefix. */
	data: string;
}

/**
 * The file system operations the store needs. Kept as an interface so that the
 * string transformation can be tested without VS Code.
 */
export interface LinkedImageHost {
	/** Reads a relative image reference. Returns undefined if it cannot be read. */
	readImage(ref: string): Promise<LinkedImageData | undefined>;
}

const STYLE_ATTRIBUTE = /(\bstyle=")([^"]*)(")/g;
/** Draw.io's short data URI form: the `;base64` marker is removed. */
const SHORT_DATA_IMAGE = /^data:(image\/[a-z0-9.+-]+),([A-Za-z0-9+/=]+)$/i;

const extensionToMime: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".bmp": "image/bmp",
	".svg": "image/svg+xml",
	".avif": "image/avif",
};

export function mimeFromExtension(extension: string): string | undefined {
	return extensionToMime[extension.toLowerCase()];
}

/**
 * Only relative references are supported. Absolute paths, URLs and data URIs
 * are kept as they are (they were not created by this extension).
 */
export function isRelativeImageRef(value: string): boolean {
	const ref = value.trim();
	if (!ref || /^[a-z][a-z0-9+.-]*:/i.test(ref)) {
		return false;
	}
	return !ref.startsWith("/") && !ref.startsWith("\\") && !ref.startsWith("//");
}

/** Parses draw.io's short data URI form, or returns undefined. */
export function parseEmbeddedImage(
	value: string
): LinkedImageData | undefined {
	const match = SHORT_DATA_IMAGE.exec(value.trim());
	if (!match) {
		return undefined;
	}
	return { mime: match[1].toLowerCase(), data: match[2] };
}

/** A short, filename-safe digest of the image content. */
export function imageKey(mime: string, data: string): string {
	// Two independent 32-bit hashes plus the length. Not cryptographic: it is
	// only used to name extracted files and to recognize unchanged images.
	let h1 = 0x811c9dc5;
	let h2 = 0x01000193;
	const value = mime + ":" + data.length + ":" + data;
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
		h2 = Math.imul(h2 ^ code, 0x85ebca6b) >>> 0;
	}
	return h1.toString(36) + h2.toString(36) + value.length.toString(36);
}

/** Converts a short data URI into one a browser `<img>` can load. */
export function toBrowserDataUri(value: string): string {
	const comma = value.indexOf(",");
	if (
		comma > 0 &&
		value.startsWith("data:") &&
		value.substring(comma - 7, comma + 1) !== ";base64,"
	) {
		return (
			value.substring(0, comma) + ";base64," + value.substring(comma + 1)
		);
	}
	return value;
}

export class LinkedImageStore {
	/** Content digest -> relative reference seen on disk. */
	private readonly refByKey = new Map<string, string>();

	private lastInput: string | undefined;
	private lastDirection: "editor" | "disk" | undefined;
	private lastOutput: string | undefined;

	constructor(private readonly host: LinkedImageHost) {}

	/** Registers a known relative reference for an image's content. */
	public registerRef(mime: string, data: string, ref: string): void {
		this.refByKey.set(imageKey(mime, data), ref);
		this.invalidateCache();
	}

	/** Disk form -> editor form (relative references become data URIs). */
	public async toEditor(xml: string): Promise<string> {
		return this.convert(xml, false);
	}

	/** Editor form -> disk form (data URIs become relative references). */
	public async toDisk(xml: string): Promise<string> {
		return this.convert(xml, true);
	}

	private invalidateCache(): void {
		this.lastInput = undefined;
		this.lastDirection = undefined;
		this.lastOutput = undefined;
	}

	private async convert(xml: string, toDisk: boolean): Promise<string> {
		const direction = toDisk ? "disk" : "editor";
		if (this.lastInput === xml && this.lastDirection === direction) {
			return this.lastOutput!;
		}

		// Split the XML into literal segments and style attribute values. The
		// values are transformed concurrently, then everything is joined back
		// in the original order, so untouched XML is byte-for-byte identical.
		const segments: { text: string; style?: string }[] = [];
		STYLE_ATTRIBUTE.lastIndex = 0;
		let last = 0;
		let match: RegExpExecArray | null;
		while ((match = STYLE_ATTRIBUTE.exec(xml)) !== null) {
			const start = match.index;
			segments.push({ text: xml.slice(last, start + match[1].length) });
			segments.push({ text: match[2], style: match[2] });
			segments.push({ text: match[3] });
			last = start + match[0].length;
		}
		segments.push({ text: xml.slice(last) });

		const results = await Promise.all(
			segments.map((segment) =>
				segment.style === undefined
					? undefined
					: this.convertStyle(segment.style, toDisk)
			)
		);
		const output = segments
			.map((segment, i) => results[i] ?? segment.text)
			.join("");

		this.lastInput = xml;
		this.lastDirection = direction;
		this.lastOutput = output;
		return output;
	}

	private async convertStyle(style: string, toDisk: boolean): Promise<string> {
		// A style is a `;`-separated list of `key=value` pairs. Inline SVG data
		// URIs may contain semicolons, but they are split and joined again
		// unchanged, so no information is lost.
		const parts = style.split(";");
		const result = await Promise.all(
			parts.map(async (part) => {
				const equals = part.indexOf("=");
				if (equals < 0 || part.slice(0, equals).trim() !== "image") {
					return part;
				}
				const value = part.slice(equals + 1);
				if (!value) {
					return part;
				}

				if (toDisk) {
					const embedded = parseEmbeddedImage(value);
					if (!embedded) {
						return part;
					}
					// Only restore references that came from a file on disk.
					// Embedded data with no known reference is left alone: this
					// extension does not create image files.
					const ref = this.refByKey.get(
						imageKey(embedded.mime, embedded.data)
					);
					return ref ? "image=" + ref : part;
				}

				if (!isRelativeImageRef(value)) {
					return part;
				}
				const ref = value.trim();
				const image = await this.host.readImage(ref);
				if (!image) {
					// Keep the reference: the user may fix the path in the text
					// editor without losing the cell.
					return part;
				}
				this.refByKey.set(imageKey(image.mime, image.data), ref);
				return "image=data:" + image.mime + "," + image.data;
			})
		);
		return result.join(";");
	}
}
