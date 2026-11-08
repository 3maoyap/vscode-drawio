const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

function loadLinkedImages() {
	const filename = path.resolve(__dirname, "../../src/utils/linkedImages.ts");
	const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2020,
		},
	}).outputText;
	const exports = {};
	vm.runInNewContext(source, { exports }, { filename });
	return exports;
}

const {
	LinkedImageStore,
	isRelativeImageRef,
	parseEmbeddedImage,
	imageKey,
	toBrowserDataUri,
	mimeFromExtension,
} = loadLinkedImages();

const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQ";
const OTHER_BASE64 = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function diagramWith(...styles) {
	const cells = styles
		.map(
			(style, i) =>
				`<mxCell id="c${i}" value="" style="${style}"><mxGeometry width="80" height="80" as="geometry"/></mxCell>`
		)
		.join("\n");
	return `<mxfile><diagram name="Page-1"><mxGraphModel><root>${cells}</root></mxGraphModel></diagram></mxfile>`;
}

function makeHost(overrides = {}) {
	const host = {
		reads: [],
		files: new Map([["./images/a.png", { mime: "image/png", data: PNG_BASE64 }]]),
		async readImage(ref) {
			this.reads.push(ref);
			return this.files.get(ref);
		},
		...overrides,
	};
	return host;
}

test("relative references are accepted, absolute ones are not", () => {
	assert.equal(isRelativeImageRef("./images/a.png"), true);
	assert.equal(isRelativeImageRef("images/a.png"), true);
	assert.equal(isRelativeImageRef("../images/a.png"), true);
	assert.equal(isRelativeImageRef("data:image/png," + PNG_BASE64), false);
	assert.equal(isRelativeImageRef("https://example.com/a.png"), false);
	assert.equal(isRelativeImageRef("/tmp/a.png"), false);
	assert.equal(isRelativeImageRef("C:/tmp/a.png"), false);
	assert.equal(isRelativeImageRef(""), false);
});

test("only draw.io short data URIs are extracted", () => {
	const parsed = parseEmbeddedImage("data:image/png," + PNG_BASE64);
	assert.equal(parsed.mime, "image/png");
	assert.equal(parsed.data, PNG_BASE64);
	assert.equal(parseEmbeddedImage("data:image/png;base64," + PNG_BASE64), undefined);
	assert.equal(parseEmbeddedImage("data:image/svg+xml,<svg></svg>"), undefined);
	assert.equal(parseEmbeddedImage("./images/a.png"), undefined);
	assert.equal(toBrowserDataUri("data:image/png," + PNG_BASE64), "data:image/png;base64," + PNG_BASE64);
	assert.equal(mimeFromExtension(".JPG"), "image/jpeg");
	assert.equal(imageKey("image/png", PNG_BASE64), imageKey("image/png", PNG_BASE64));
	assert.notEqual(imageKey("image/png", PNG_BASE64), imageKey("image/png", OTHER_BASE64));
});

test("a relative reference becomes a short data URI in the editor", async () => {
	const xml = diagramWith("shape=image;image=./images/a.png;aspect=fixed;");
	const host = makeHost();
	const store = new LinkedImageStore(host);

	const editorXml = await store.toEditor(xml);

	assert.ok(editorXml.includes("image=data:image/png," + PNG_BASE64));
	assert.ok(editorXml.includes("aspect=fixed"));
	assert.ok(!editorXml.includes("./images/a.png"));
	assert.deepEqual(host.reads, ["./images/a.png"]);
});

test("round trip restores the exact reference on disk", async () => {
	const xml = diagramWith("shape=image;image=./images/a.png;aspect=fixed;");
	const store = new LinkedImageStore(makeHost());

	const editorXml = await store.toEditor(xml);
	const diskXml = await store.toDisk(editorXml);

	assert.equal(diskXml, xml);
});

test("embedded images with no known reference are left untouched", async () => {
	// The extension never creates image files: pasted images keep their
	// embedded data instead of being written into a generated directory.
	const xml = diagramWith("shape=image;image=data:image/png," + OTHER_BASE64 + ";");
	const store = new LinkedImageStore(makeHost());

	const diskXml = await store.toDisk(xml);

	assert.equal(diskXml, xml);
	assert.ok(diskXml.includes(OTHER_BASE64));
});

test("the same reference is restored for repeated cells", async () => {
	const xml = diagramWith(
		"shape=image;image=./images/a.png;",
		"shape=image;image=./images/a.png;"
	);
	const host = makeHost();
	const store = new LinkedImageStore(host);

	const editorXml = await store.toEditor(xml);
	const diskXml = await store.toDisk(editorXml);

	assert.equal(diskXml, xml);
});

test("external links, absolute paths and unsupported data URIs are untouched", async () => {
	const xml = diagramWith(
		"shape=image;image=https://example.com/a.png;",
		"shape=image;image=/tmp/a.png;",
		"shape=image;image=data:image/svg+xml,<svg></svg>;aspect=fixed;"
	);
	const host = makeHost();
	const store = new LinkedImageStore(host);

	assert.equal(await store.toEditor(xml), xml);
	assert.equal(await store.toDisk(xml), xml);
	assert.deepEqual(host.reads, []);
});

test("a missing image file keeps its reference", async () => {
	const xml = diagramWith("shape=image;image=./images/missing.png;");
	const host = makeHost({ files: new Map() });
	const store = new LinkedImageStore(host);

	assert.equal(await store.toEditor(xml), xml);
	assert.equal(await store.toDisk(xml), xml);
});

test("conversion is idempotent and keeps unrelated XML intact", async () => {
	const xml =
		'<mxfile host="app.diagrams.net"><diagram id="d1" name="Page-1">' +
		'<mxCell id="0" style="shape=image;image=./images/a.png;rounded=1;"/>' +
		'<mxCell id="1" value="a &amp; b" style="text;html=1;"><mxGeometry as="geometry"/></mxCell>' +
		"</diagram></mxfile>";
	const store = new LinkedImageStore(makeHost());

	const editorXml = await store.toEditor(xml);
	const diskXml = await store.toDisk(editorXml);

	assert.equal(diskXml, xml);
	assert.equal(await store.toDisk(diskXml), diskXml);
	assert.equal(await store.toEditor(editorXml), editorXml);
});

test("registerRef keeps a dropped file's own path", async () => {
	const host = makeHost();
	const store = new LinkedImageStore(host);
	store.registerRef("image/png", PNG_BASE64, "./screenshots/ui.png");

	const diskXml = await store.toDisk(
		diagramWith("shape=image;image=data:image/png," + PNG_BASE64 + ";")
	);

	assert.ok(diskXml.includes("image=./screenshots/ui.png"));
});
