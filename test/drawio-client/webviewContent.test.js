const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const htmlPath = path.resolve(
	__dirname,
	"../../src/DrawioClient/webview-content.html"
);

/** Inline scripts, with the host's $$...$$ placeholders replaced by valid JS. */
function inlineScripts() {
	const html = fs.readFileSync(htmlPath, "utf8");
	const result = [];
	const tag = /<script([^>]*)>([\s\S]*?)<\/script>/g;
	let match;
	while ((match = tag.exec(html)) !== null) {
		if (/\bsrc\s*=/.test(match[1])) continue;
		result.push(match[2].replace(/\$\$[^$]+\$\$/g, "[]"));
	}
	return result;
}

test("all inline webview scripts are syntactically valid", () => {
	const scripts = inlineScripts();
	assert.ok(scripts.length >= 2);
	for (const source of scripts) {
		assert.doesNotThrow(() => new vm.Script(source));
	}
});

test("the linked image bridge covers drops, dialogs and host responses", () => {
	const all = inlineScripts().join("\n");
	assert.ok(all.includes('event: "resolveImageRefs"'));
	assert.ok(all.includes('data.action !== "imageRefsResolved"'));
	assert.ok(all.includes('"drop"'));
	assert.ok(all.includes('"loadImage"'));
	assert.ok(all.includes('"showImageDialog"'));
	assert.ok(all.includes("IMAGE_FILE"));
	assert.ok(all.includes("normalizeUri"));
	assert.ok(all.includes("resetDropHighlights()"));
	assert.ok(all.includes("rememberDropTarget(target)"));
	assert.ok(all.includes('eventName === "dragleave"'));
	assert.ok(all.includes("seen.has(item.value)"));
});
