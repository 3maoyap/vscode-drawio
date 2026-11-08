import * as path from "path";
import { Uri, workspace } from "vscode";
import { BufferImpl } from "./buffer";
import {
	isRelativeImageRef,
	LinkedImageData,
	LinkedImageHost,
	LinkedImageStore,
	mimeFromExtension,
} from "./linkedImages";

/** Creates the store used by an editor for a given diagram file. */
export function createLinkedImageStore(diagramUri: Uri): LinkedImageStore {
	return new LinkedImageStore(new VscodeLinkedImageHost(diagramUri));
}

/**
 * Read-only file access for `LinkedImageStore`: images must already exist in
 * the workspace, the extension never creates or copies them. All references
 * are relative to the diagram's directory and must stay inside the workspace,
 * so a diagram never contains an absolute or machine-specific path.
 */
export class VscodeLinkedImageHost implements LinkedImageHost {
	private readonly diagramDir: string;

	constructor(private readonly diagramUri: Uri) {
		this.diagramDir = path.dirname(diagramUri.fsPath);
	}

	/** Returns a relative reference for a file dropped from the VS Code explorer. */
	public getRelativeRef(fileUri: Uri): string | undefined {
		if (fileUri.scheme !== "file" || !this.isInsideWorkspace(fileUri.fsPath)) {
			return undefined;
		}
		const relative = path.relative(this.diagramDir, fileUri.fsPath);
		if (!relative || path.isAbsolute(relative)) {
			return undefined;
		}
		const ref = normalizeRef(relative.split(path.sep).join("/"));
		return isRelativeImageRef(ref) ? ref : undefined;
	}

	public async readImage(ref: string): Promise<LinkedImageData | undefined> {
		if (!isRelativeImageRef(ref)) {
			return undefined;
		}
		let clean: string;
		try {
			clean = decodeURIComponent(ref.split(/[?#]/)[0]).replace(/\\/g, "/");
		} catch {
			return undefined;
		}
		if (!clean || clean.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(clean)) {
			return undefined;
		}
		const target = path.resolve(this.diagramDir, clean);
		if (!this.isInsideWorkspace(target)) {
			return undefined;
		}
		const uri = Uri.file(target);
		const mime = mimeFromExtension(path.extname(uri.fsPath));
		if (!mime) {
			return undefined;
		}
		try {
			const bytes = await workspace.fs.readFile(uri);
			return { mime, data: BufferImpl.from(bytes).toString("base64") };
		} catch {
			return undefined;
		}
	}

	private isInsideWorkspace(candidate: string): boolean {
		const folder = workspace.getWorkspaceFolder(this.diagramUri);
		const root = folder ? folder.uri.fsPath : this.diagramDir;
		const target = path.resolve(candidate);
		if (target === root) {
			return true;
		}
		const prefix = root.endsWith(path.sep) ? root : root + path.sep;
		return process.platform === "win32"
			? target.toLowerCase().startsWith(prefix.toLowerCase())
			: target.startsWith(prefix);
	}
}

/** Makes a relative path use `/` and a leading `./`. */
function normalizeRef(value: string): string {
	const posix = value.replace(/\\/g, "/").replace(/^\.\//, "");
	return "./" + posix;
}
