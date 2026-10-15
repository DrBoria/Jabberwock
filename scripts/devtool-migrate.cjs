#!/usr/bin/env node
/**
 * One-shot migration script for the devtool package restructure.
 *
 * 1. Moves files from the legacy layout to:
 *    src/{utils,server,backend,frontend,framework}
 * 2. Rewrites every relative import/export specifier so it resolves to the
 *    file's NEW location (NodeNext .js-extension style preserved).
 *
 * Idempotency: if a file is already at its new location, it is skipped.
 * Run: node scripts/devtool-migrate.cjs
 */
const fs = require("node:fs");
const path = require("node:path");

const PKG = path.join(__dirname, "..", "packages", "vscode-extension-devtool-mcp");
const SRC = path.join(PKG, "src");

/** old relative path (from src/) -> new relative path (from src/) */
const MAP = {
	// --- framework/mobx (was api/mst) ---
	"api/mst/types.ts": "framework/mobx/types.ts",
	"api/mst/actions-buffer.ts": "framework/mobx/actions-buffer.ts",
	"api/mst/actions-main.ts": "framework/mobx/actions-main.ts",
	"api/mst/search.ts": "framework/mobx/search.ts",
	"api/mst/index.ts": "framework/mobx/index.ts",
	"api/mst/snapshot/index.ts": "framework/mobx/snapshot/index.ts",
	"api/mst/snapshot/state.ts": "framework/mobx/snapshot/state.ts",
	"api/mst/snapshot/store.ts": "framework/mobx/snapshot/store.ts",
	"api/mst/snapshot/tree.ts": "framework/mobx/snapshot/tree.ts",
	"api/mst/snapshot/truncate.ts": "framework/mobx/snapshot/truncate.ts",

	// --- backend (was api/* + root devtool/main/methods) ---
	"api/bridge.ts": "backend/bridge.ts",
	"api/factory.ts": "backend/factory.ts",
	"api/http-server.ts": "backend/http-server.ts",
	"api/index.ts": "backend/api/index.ts",
	"api/factories/factory-console.ts": "backend/factories/factory-console.ts",
	"api/factories/factory-dom.ts": "backend/factories/factory-dom.ts",
	"api/factories/factory-helpers.ts": "backend/factories/factory-helpers.ts",
	"api/factories/factory-mock.ts": "backend/factories/factory-mock.ts",
	"api/factories/factory-state.ts": "backend/factories/factory-state.ts",
	"api/factories/index.ts": "backend/factories/index.ts",
	"api/mcp-entry/index.ts": "backend/mcp-entry/index.ts",
	"api/mcp-entry/server.ts": "backend/mcp-entry/server.ts",
	"api/mcp-entry/schemas.ts": "backend/mcp-entry/schemas.ts",
	"api/mcp-entry/target-identity.ts": "backend/mcp-entry/target-identity.ts",
	"api/mcp-entry/renderer-console.ts": "backend/mcp-entry/renderer-console.ts",
	"api/mcp-entry/cdp-console-buffer.ts": "backend/mcp-entry/cdp-console-buffer.ts",
	"api/tools/commands.ts": "backend/tools/commands.ts",
	"api/tools/console.ts": "backend/tools/console.ts",
	"api/tools/diagnostics.ts": "backend/tools/diagnostics.ts",
	"api/tools/dom.ts": "backend/tools/dom.ts",
	"api/tools/eventBus.ts": "backend/tools/eventBus.ts",
	"api/tools/index.ts": "backend/tools/index.ts",
	"api/tools/state.ts": "backend/tools/state.ts",
	"api/tools/tool-utils.ts": "backend/tools/tool-utils.ts",
	"api/debug-mcp-proxy.mjs": "backend/debug-mcp-proxy.mjs",
	"devtool.ts": "backend/devtool.ts",
	"main.ts": "backend/main.ts",
	"methods.ts": "backend/methods.ts",

	// --- utils (was api/utils + root rpc/transport + utils) ---
	"api/utils/interceptor.ts": "utils/interceptor.ts",
	"rpc.ts": "utils/rpc.ts",
	"transport.ts": "utils/transport.ts",

	// --- backend/diagnostics (was diagnostics) ---
	"diagnostics/DevToolsLogger.ts": "backend/diagnostics/DevToolsLogger.ts",
	"diagnostics/index.ts": "backend/diagnostics/index.ts",
	"diagnostics/types.ts": "backend/diagnostics/types.ts",
	"diagnostics/managers/DiagnosticsManager.ts": "backend/diagnostics/managers/DiagnosticsManager.ts",
	"diagnostics/managers/index.ts": "backend/diagnostics/managers/index.ts",
	"diagnostics/managers/LifecycleManager.ts": "backend/diagnostics/managers/LifecycleManager.ts",
	"diagnostics/managers/LogFileManager.ts": "backend/diagnostics/managers/LogFileManager.ts",
	"diagnostics/trackers/index.ts": "backend/diagnostics/trackers/index.ts",
	"diagnostics/trackers/ResourceMonitor.ts": "backend/diagnostics/trackers/ResourceMonitor.ts",
	"diagnostics/trackers/SnapshotBuilder.ts": "backend/diagnostics/trackers/SnapshotBuilder.ts",
	"diagnostics/trackers/TimelineTracker.ts": "backend/diagnostics/trackers/TimelineTracker.ts",
	"diagnostics/trackers/Tracer.ts": "backend/diagnostics/trackers/Tracer.ts",

	// --- frontend/dom (was dom) ---
	"dom/action-handlers.ts": "frontend/dom/action-handlers.ts",
	"dom/iframe.ts": "frontend/dom/iframe.ts",
	"dom/index.ts": "frontend/dom/index.ts",
	"dom/lookup.ts": "frontend/dom/lookup.ts",
	"dom/store-query-handlers.ts": "frontend/dom/store-query-handlers.ts",
	"dom/types.ts": "frontend/dom/types.ts",
	"dom/create-message-handler.ts": "frontend/dom/create-message-handler.ts",
	"dom/bridge/create-frontend-bridge.ts": "frontend/dom/bridge/create-frontend-bridge.ts",
	"dom/bridge/index.ts": "frontend/dom/bridge/index.ts",
	"dom/bridge/register-dom-response-handler.ts": "frontend/dom/bridge/register-dom-response-handler.ts",
	"dom/bridge/webview-store-bridge.ts": "frontend/dom/bridge/webview-store-bridge.ts",
	"dom/consumer/actions.ts": "frontend/dom/consumer/actions.ts",
	"dom/consumer/dom-consumer-setup.ts": "frontend/dom/consumer/dom-consumer-setup.ts",
	"dom/consumer/index.ts": "frontend/dom/consumer/index.ts",
	"dom/consumer/utils.ts": "frontend/dom/consumer/utils.ts",
	"dom/handlers/finding/iframe.ts": "frontend/dom/handlers/finding/iframe.ts",
	"dom/handlers/finding/index.ts": "frontend/dom/handlers/finding/index.ts",
	"dom/handlers/finding/main.ts": "frontend/dom/handlers/finding/main.ts",
	"dom/handlers/getActivePage.ts": "frontend/dom/handlers/getActivePage.ts",
	"dom/handlers/getScreenshot.ts": "frontend/dom/handlers/getScreenshot.ts",
	"dom/handlers/index.ts": "frontend/dom/handlers/index.ts",
	"dom/handlers/runCommand.ts": "frontend/dom/handlers/runCommand.ts",
	"dom/handlers/interaction/clickElement.ts": "frontend/dom/handlers/interaction/clickElement.ts",
	"dom/handlers/interaction/drag.ts": "frontend/dom/handlers/interaction/drag.ts",
	"dom/handlers/interaction/index.ts": "frontend/dom/handlers/interaction/index.ts",
	"dom/handlers/interaction/scrollElement.ts": "frontend/dom/handlers/interaction/scrollElement.ts",
	"dom/handlers/interaction/selectOption.ts": "frontend/dom/handlers/interaction/selectOption.ts",
	"dom/handlers/interaction/typeText.ts": "frontend/dom/handlers/interaction/typeText.ts",
	"dom/serialization/dom-tree.ts": "frontend/dom/serialization/dom-tree.ts",
	"dom/serialization/helpers.ts": "frontend/dom/serialization/helpers.ts",
	"dom/serialization/index.ts": "frontend/dom/serialization/index.ts",

	// --- frontend/webview (was webview) ---
	"webview/console.ts": "frontend/webview/console.ts",
	"webview/DevtoolProvider.tsx": "frontend/webview/DevtoolProvider.tsx",
	"webview/index.ts": "frontend/webview/index.ts",
	"webview/LocatorBridge.tsx": "frontend/webview/LocatorBridge.tsx",
	"webview/main.ts": "frontend/webview/main.ts",
	"webview/utils.ts": "frontend/webview/utils.ts",
	"webview/vscode.ts": "frontend/webview/vscode.ts",
	"webview/DevToolsStore/store.ts": "frontend/webview/DevToolsStore/store.ts",
	"webview/diagnostic-dashboard/dashboard.css": "frontend/webview/diagnostic-dashboard/dashboard.css",
	"webview/diagnostic-dashboard/format-bytes.ts": "frontend/webview/diagnostic-dashboard/format-bytes.ts",
	"webview/diagnostic-dashboard/header.tsx": "frontend/webview/diagnostic-dashboard/header.tsx",
	"webview/diagnostic-dashboard/icons.tsx": "frontend/webview/diagnostic-dashboard/icons.tsx",
	"webview/diagnostic-dashboard/index.ts": "frontend/webview/diagnostic-dashboard/index.ts",
	"webview/diagnostic-dashboard/main.tsx": "frontend/webview/diagnostic-dashboard/main.tsx",
	"webview/diagnostic-dashboard/tab-content.tsx": "frontend/webview/diagnostic-dashboard/tab-content.tsx",
	"webview/diagnostic-dashboard/use-diagnostic-data.ts": "frontend/webview/diagnostic-dashboard/use-diagnostic-data.ts",
};

const reverseMap = new Map(Object.entries(MAP).map(([o, n]) => [n, o])); // new -> old

/** Convert a source-file path (.ts/.tsx/.mjs) to its import-specifier form (.js/.jsx). */
function toSpecifierForm(p) {
	if (p.endsWith(".tsx")) return p.slice(0, -4) + ".jsx";
	if (p.endsWith(".ts")) return p.slice(0, -3) + ".js";
	return p; // .mjs etc.
}

/** Convert an import specifier (.js/.jsx) back to a source-file path for MAP lookup. */
function toSourceForm(p) {
	if (p.endsWith(".jsx")) return p.slice(0, -4) + ".tsx";
	if (p.endsWith(".js")) return p.slice(0, -3) + ".ts";
	return p;
}

/** Look up where a (source-form) target moved to, tolerating .js specifiers that point at .tsx files. */
function mapTarget(oldTarget) {
	if (MAP[oldTarget]) return MAP[oldTarget];
	if (oldTarget.endsWith(".ts")) {
		const tsx = oldTarget.slice(0, -3) + ".tsx";
		if (MAP[tsx]) return MAP[tsx];
	}
	return oldTarget;
}

/** Collect all files under src (relative, posix). */
function listFiles(dir, base = SRC) {
	const out = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		const rel = path.relative(base, full).split(path.sep).join("/");
		if (entry.isDirectory()) out.push(...listFiles(full, base));
		else out.push(rel);
	}
	return out;
}

/** Compute a NodeNext-style relative specifier from one file to another (both relative to SRC, posix). */
function relSpecifier(fromRel, toRel) {
	const fromDir = path.posix.dirname(fromRel);
	let rel = path.posix.relative(fromDir, toRel);
	if (!rel.startsWith(".")) rel = `./${rel}`;
	// Normalize backslashes (shouldn't happen on posix, but be safe)
	rel = rel.split(path.sep).join("/");
	return rel;
}

let moved = 0;
let rewritten = 0;
const problems = [];

// ---- Phase 1: move files ----
for (const [oldRel, newRel] of Object.entries(MAP)) {
	const from = path.join(SRC, ...oldRel.split("/"));
	const to = path.join(SRC, ...newRel.split("/"));
	if (!fs.existsSync(from)) {
		if (fs.existsSync(to)) {
			// already moved — fine
			continue;
		}
		problems.push(`missing source: ${oldRel}`);
		continue;
	}
	if (fs.existsSync(to)) {
		problems.push(`destination exists: ${newRel}`);
		continue;
	}
	fs.mkdirSync(path.dirname(to), { recursive: true });
	fs.renameSync(from, to);
	moved++;
}

// ---- Phase 2: rewrite imports in all TS/TSX/MJS files ----
const IMPORT_RE = /(from\s+|import\s+|export\s+\*\s+from\s+|import\s*\()\s*["'](\.[^"']+)["']/g;

function rewriteFile(rel) {
	const full = path.join(SRC, ...rel.split("/"));
	const text = fs.readFileSync(full, "utf8");
	let changed = false;
	let count = 0;
	const next = text.replace(IMPORT_RE, (match, prefix, spec) => {
		// Resolve the OLD absolute target relative to the OLD file location.
		// We need the OLD location of THIS file to resolve `spec` correctly.
		const oldFileRel = reverseMap.get(rel) ?? rel; // if this file was moved
		const oldFromDir = path.posix.dirname(oldFileRel);
		const oldTarget = path.posix.normalize(path.posix.join(oldFromDir, toSourceForm(spec)));
		const newTarget = mapTarget(oldTarget); // where the target lives now
		// Recompute the specifier from the NEW file location to the NEW target location,
		// preserving the original specifier's extension (.js vs .jsx) — the codebase mixes both.
		const specExt = spec.endsWith(".jsx") ? ".jsx" : ".js";
		const newTargetBase = newTarget.replace(/\.(ts|tsx|mjs)$/, "");
		const newSpec = relSpecifier(rel, newTargetBase + specExt);
		if (newSpec === spec) return match;
		changed = true;
		count++;
		return `${prefix}"${newSpec}"`;
	});
	if (changed) {
		fs.writeFileSync(full, next);
		rewritten += count;
	}
}

// Rewrite every file in its NEW location.
const allFiles = listFiles(SRC).filter((f) => /\.(ts|tsx|mjs)$/.test(f));
for (const rel of allFiles) rewriteFile(rel);

// ---- Phase 3: clean up empty legacy dirs ----
function removeEmptyDirs(dir) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const full = path.join(dir, entry.name);
		removeEmptyDirs(full);
		if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
	}
}
for (const legacy of ["api", "diagnostics", "dom", "webview"]) {
	const full = path.join(SRC, legacy);
	if (fs.existsSync(full)) removeEmptyDirs(full);
}

console.log(`moved=${moved} importSpecifiersRewritten=${rewritten} filesScanned=${allFiles.length}`);
if (problems.length) {
	console.error("PROBLEMS:");
	for (const p of problems) console.error("  " + p);
	process.exitCode = 1;
}
