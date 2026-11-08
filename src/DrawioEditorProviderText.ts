import {
	CancellationToken,
	CustomTextEditorProvider,
	Range,
	TextDocument,
	Uri,
	WebviewPanel,
	window,
	workspace,
	WorkspaceEdit,
} from "vscode";
import formatter = require("xml-formatter");
import { DrawioEditorService } from "./DrawioEditorService";
import { isRelativeImageRef } from "./utils/linkedImages";
import { VscodeLinkedImageHost } from "./utils/vscodeLinkedImageHost";

export class DrawioEditorProviderText implements CustomTextEditorProvider {
	constructor(private readonly drawioEditorService: DrawioEditorService) {}

	public async resolveCustomTextEditor(
		document: TextDocument,
		webviewPanel: WebviewPanel,
		token: CancellationToken
	): Promise<void> {
		try {
			const readonlySchemes = new Set(["git", "conflictResolution"]);
			const isReadOnly = readonlySchemes.has(document.uri.scheme);

			const editor =
				await this.drawioEditorService.createDrawioEditorInWebview(
					webviewPanel,
					{
						kind: "text",
						document,
					},
					{ isReadOnly }
				);
			const drawioClient = editor.drawioClient;
			// Shared with the export paths so that extracted images keep their
			// relative references instead of being written a second time.
			const imageHost = new VscodeLinkedImageHost(document.uri);
			const linkedImages = editor.linkedImages;

			// Resolves local image references for the webview. Accepts relative
			// paths (typed into the Insert Image dialog) and file URIs / absolute
			// paths (dropped from the VS Code explorer). The relative reference
			// is registered so the saved diagram keeps that exact path.
			drawioClient.onResolveImageRefs.sub(async ({ requestId, refs }) => {
				const images: ({ value: string } | null)[] = [];
				for (const raw of refs) {
					let ref: string | undefined;
					try {
						if (/^file:\/\//i.test(raw)) {
							ref = imageHost.getRelativeRef(Uri.parse(raw, true));
						} else if (/^[a-z]:[\\/]/i.test(raw) || raw.startsWith("\\\\")) {
							ref = imageHost.getRelativeRef(Uri.file(raw));
						} else if (isRelativeImageRef(raw)) {
							ref = raw.trim();
						}
						const image = ref ? await imageHost.readImage(ref) : undefined;
						if (!ref || !image) {
							images.push(null);
							continue;
						}
						linkedImages.registerRef(image.mime, image.data, ref);
						images.push({ value: `data:${image.mime},${image.data}` });
					} catch {
						images.push(null);
					}
				}
				drawioClient.sendImageRefsResolved({ requestId, images });
			});

			interface NormalizedDocument {
				equals(other: this): boolean;
			}

			function getNormalizedDocument(src: string): NormalizedDocument {
				const result = {
					src,
					equals: (o: any) => o.src === src,
				};
				return result;
			}

			let lastDocument = getNormalizedDocument(document.getText());
			let isThisEditorSaving = false;

			workspace.onDidChangeTextDocument(async (evt) => {
				if (evt.document !== document) {
					return;
				}
				if (isThisEditorSaving) {
					// We don't want to process our own changes.
					return;
				}
				if (evt.contentChanges.length === 0) {
					// Sometimes VS Code reports a document change without a change.
					return;
				}

				const newText = evt.document.getText();
				const newDocument = getNormalizedDocument(newText);
				if (newDocument.equals(lastDocument)) {
					return;
				}
				lastDocument = newDocument;

				await drawioClient.mergeXmlLike(await linkedImages.toEditor(newText));
			});

			// Tracks the most recent onChange edit so a save can wait for it to be
			// applied to the document before persisting (see onSave below).
			let pendingChange: Promise<void> = Promise.resolve();

			drawioClient.onChange.sub(({ newXml }) => {
				pendingChange = applyChange(newXml);
				return pendingChange;
			});

			async function applyChange(newXml: string): Promise<void> {
				// We format the xml so that it can be easily edited in a second text editor.
				async function getOutput(): Promise<string> {
					if (document.uri.path.endsWith(".svg")) {
						const svg =
							await drawioClient.exportAsSvgWithEmbeddedXml();
						newXml = svg.toString("utf-8");

						// This adds a host to track which files are created by this extension and which by draw.io desktop.
						newXml = newXml.replace(
							/^<svg /,
							() => `<svg host="65bd71144e" `
						);

						return formatter(newXml);
					} else {
						// Images are stored as relative references on disk only.
						// Draw.io needs short data URIs to render them in the webview.
						newXml = await linkedImages.toDisk(newXml);

						if (newXml.startsWith('<mxfile host="')) {
							newXml = newXml.replace(
								/^<mxfile host="(.*?)"/,
								() => `<mxfile host="65bd71144e"`
							);
						} else {
							// in case there is no host attribute
							newXml = newXml
								.replace(
									/^<mxfile /,
									() => `<mxfile host="65bd71144e"`
								)
								.replace(
									/^<mxfile>/,
									() => `<mxfile host="65bd71144e">`
								);
						}

						return formatter(
							// This normalizes the host
							newXml
						);
					}
				}

				const output = await getOutput();
				const newDocument = getNormalizedDocument(output);
				if (newDocument.equals(lastDocument)) {
					return;
				}
				lastDocument = newDocument;

				const workspaceEdit = new WorkspaceEdit();

				// TODO diff the new document with the old document and only edit the changes.
				workspaceEdit.replace(
					document.uri,
					new Range(0, 0, document.lineCount, 0),
					output
				);

				isThisEditorSaving = true;
				try {
					if (!(await workspace.applyEdit(workspaceEdit))) {
						window.showErrorMessage(
							"Could not apply Draw.io document changes to the underlying document. Try to save again!"
						);
					}
				} finally {
					isThisEditorSaving = false;
				}
			}

			drawioClient.onSave.sub(async () => {
				// A save may have just emitted an onChange (above) carrying an edit
				// that autosave hadn't reported yet. Wait for that edit to be
				// applied to the document before persisting, so a single Save both
				// updates and saves the file in one step (no second click needed).
				try {
					await pendingChange;
				} catch {
					// The pending edit failed to apply (the onChange handler
					// surfaces its own error); still attempt to save.
				}
				await document.save();
			});

			drawioClient.onInit.sub(async () => {
				drawioClient.loadXmlLike(
					await linkedImages.toEditor(document.getText())
				);
			});
		} catch (e) {
			window.showErrorMessage(`Failed to open diagram: ${e}`);
			throw e;
		}
	}
}
