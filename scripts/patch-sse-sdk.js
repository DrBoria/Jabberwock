/**
 * Patch MCP SDK SSE client to use ReconnectingEventSource.
 *
 * MCP SDK v1.12.0 imports EventSource directly from the "eventsource" package.
 * This means global.EventSource = ReconnectingEventSource in McpHub.ts has NO EFFECT.
 *
 * This patch replaces the direct import with a check for global.EventSource first,
 * falling back to the original import. This allows ReconnectingEventSource (set via
 * global.EventSource) to actually take effect, providing automatic SSE reconnection
 * when the extension host restarts.
 */
const fs = require("fs")
const path = require("path")

const SDK_PATHS = [
	// ESM build (used by the extension)
	"node_modules/.pnpm/@modelcontextprotocol+sdk@1.12.0/node_modules/@modelcontextprotocol/sdk/dist/esm/client/sse.js",
	// CJS build
	"node_modules/.pnpm/@modelcontextprotocol+sdk@1.12.0/node_modules/@modelcontextprotocol/sdk/dist/cjs/client/sse.js",
]

function patchFile(filePath) {
	const absolutePath = path.resolve(__dirname, "..", filePath)

	if (!fs.existsSync(absolutePath)) {
		console.warn(`[patch-sse-sdk] File not found, skipping: ${filePath}`)
		return false
	}

	let content = fs.readFileSync(absolutePath, "utf-8")

	// Check if already patched
	if (content.includes("// [PATCHED] Use global.EventSource with fallback")) {
		console.log(`[patch-sse-sdk] Already patched: ${filePath}`)
		return true
	}

	// ESM: import { EventSource } from "eventsource";
	const esmPattern = /import\s*\{\s*EventSource\s*\}\s*from\s*["']eventsource["']\s*;?/
	if (esmPattern.test(content)) {
		content = content.replace(
			esmPattern,
			`// [PATCHED] Use global.EventSource with fallback to eventsource package
import { EventSource as _EventSource } from "eventsource";
const EventSource = globalThis.EventSource || _EventSource;`,
		)
		fs.writeFileSync(absolutePath, content, "utf-8")
		console.log(`[patch-sse-sdk] Patched (ESM): ${filePath}`)
		return true
	}

	// CJS: const eventsource_1 = require("eventsource");
	// Then used as: eventsource_1.EventSource
	const cjsPattern = /const\s+(\w+)\s*=\s*require\(["']eventsource["']\)\s*;?/
	if (cjsPattern.test(content)) {
		content = content.replace(
			cjsPattern,
			(match, varName) => `// [PATCHED] Use global.EventSource with fallback to eventsource package
const ${varName} = require("eventsource");
const EventSource = globalThis.EventSource || ${varName}.EventSource;`,
		)
		fs.writeFileSync(absolutePath, content, "utf-8")
		console.log(`[patch-sse-sdk] Patched (CJS): ${filePath}`)
		return true
	}

	console.warn(`[patch-sse-sdk] No import pattern found in: ${filePath}`)
	return false
}

console.log("[patch-sse-sdk] Patching MCP SDK SSE client...")
let patched = 0
for (const p of SDK_PATHS) {
	if (patchFile(p)) patched++
}
console.log(`[patch-sse-sdk] Done. Patched ${patched}/${SDK_PATHS.length} files.`)

if (patched === 0) {
	console.warn("[patch-sse-sdk] WARNING: No files were patched. Check SDK paths.")
	process.exit(1)
}
