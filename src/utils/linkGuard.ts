/**
 * Browser-side guard injected into every offline Draw.io document.
 *
 * Draw.io absolutizes a relative cell link (e.g. `./main.md`) against the
 * bundled webapp folder. VS Code's own webview link handler can open that
 * broken CDN URL in the OS browser before draw.io's handlers run, so the
 * click is caught on `window` in the capture phase and its default action is
 * cancelled. `window.open` is guarded for paths that bypass the click handler.
 *
 * In the main extension webview (`canForward === true`) the event is stopped
 * completely and the `openLink` embed event is forwarded directly, which also
 * prevents VS Code's handler from acting on it. In iframes (the local Draw.io
 * server, the Markdown code block guest) there is no VS Code API, so draw.io
 * is left to post its own `openLink` event.
 *
 * Real external links (https:, mailto:) are left alone.
 */
export function linkGuardScript(canForward: boolean): string {
	return [
		"(function (canForward) {",
		"  function isInternal(href) {",
		"    try {",
		"      var url = new URL(href, document.baseURI);",
		"      return url.hostname === '127.0.0.1' ||",
		"        url.hostname === 'localhost' ||",
		"        url.hostname.indexOf('.vscode-resource.vscode-cdn.net') !== -1 ||",
		"        url.protocol === 'vscode-webview:' ||",
		"        url.protocol === 'vscode-file:' ||",
		"        url.pathname.indexOf('/drawio/src/main/webapp/') !== -1;",
		"    } catch (e) { return false; }",
		"  }",
		"  function shouldGuard(href) {",
		"    return !/^[a-z][a-z0-9+.-]*:/i.test(href) || isInternal(href);",
		"  }",
		"  window.addEventListener('click', function (evt) {",
		"    var el = evt.target;",
		"    while (el && !(el.nodeName && String(el.nodeName).toLowerCase() === 'a')) {",
		"      el = el.parentNode || el.host || null;",
		"    }",
		"    var href = el && el.getAttribute ? el.getAttribute('href') : null;",
		"    if (!href || href.charAt(0) === '#' || /^javascript:/i.test(href)) return;",
		"    if (!shouldGuard(href)) return;",
		"    evt.preventDefault();",
		"    var api = window.VsCodeApi;",
		"    if (canForward && api) {",
		"      evt.stopImmediatePropagation();",
		"      api.postMessage(JSON.stringify({",
		"        event: 'openLink',",
		"        href: href,",
		"        target: el.getAttribute('target')",
		"      }));",
		"    }",
		"  }, true);",
		"  var originalOpen = window.open;",
		"  window.open = function (url) {",
		"    if (typeof url === 'string' && shouldGuard(url)) return null;",
		"    return originalOpen.apply(this, arguments);",
		"  };",
		"})(" + (canForward ? "true" : "false") + ");",
	].join("\n");
}
