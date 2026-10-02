/**
 * Target identity for the stdio MCP proxy.
 *
 * The devtool WS/HTTP servers live inside ONE extension host process = ONE
 * VS Code window. This module tracks WHICH window that is (learned from the
 * `/status` endpoint) and formats it into labels that are prefixed onto every
 * tool result — so the agent always sees the surface it is talking to and
 * never debugs the wrong window.
 */

export const WS_PORT = 60060
export const HTTP_STATUS_PORT = 60061

/**
 * Identity of the extension host window that owns the devtool server.
 */
export interface TargetIdentity {
	workspaceFolder: string | null
	focused: boolean | null
	pid: number | null
	buildTimestamp: string | null
}

export let targetIdentity: TargetIdentity = {
	workspaceFolder: null,
	focused: null,
	pid: null,
	buildTimestamp: null,
}

/**
 * Human-readable one-liner identifying the target window.
 */
export function targetLabel(): string {
	// A null workspaceFolder means the Extension Development Host window opened
	// without a folder (the "Welcome" window). That is normal for a debug launch
	// and does NOT affect store/console/DOM tools — it only means the extension
	// has no project context. Label it plainly instead of an alarming "unknown".
	const ws = targetIdentity.workspaceFolder ?? "(no folder open)"
	const pid = targetIdentity.pid != null ? ` pid=${targetIdentity.pid}` : ""
	// Focus is intentionally NOT part of the per-result prefix: store/console/DOM
	// tools work without window focus (focus only matters for type_text keyboard
	// input). Showing it on every result was noise. `get_target_info` still reports
	// focus explicitly when it is needed.
	return `[target: VS Code window "${ws}"${pid}]`
}

/**
 * Check if the extension is available (HTTP status responds OK).
 * Returns true if extension is running and responsive.
 * Side effect: learns the target window identity from the response.
 */
export async function checkExtensionStatus(timeoutMs: number): Promise<boolean> {
	try {
		const response = await fetch(`http://127.0.0.1:${HTTP_STATUS_PORT}/status`, {
			signal: AbortSignal.timeout(timeoutMs),
		})
		if (response.ok) {
			const data = (await response.json()) as Record<string, unknown>
			targetIdentity = {
				workspaceFolder: typeof data.workspaceFolder === "string" ? data.workspaceFolder : null,
				focused: typeof data.focused === "boolean" ? data.focused : null,
				pid: typeof data.pid === "number" ? data.pid : null,
				buildTimestamp: typeof data.buildTimestamp === "string" ? data.buildTimestamp : null,
			}
			const uptime = typeof data.uptime === "number" ? data.uptime : 0
			console.error(`[devtools] Extension available (${targetLabel()}, uptime: ${Math.floor(uptime)}s)`)
			return true
		}
	} catch {
		// HTTP fetch failed (timeout, abort, etc.) — extension may be busy or at breakpoint
	}
	return false
}

/**
 * Explicit "who am I talking to?" tool. Answered LOCALLY by the proxy (does
 * not require the extension to be running — that is exactly when you need it).
 */
export async function getTargetInfo(): Promise<string> {
	const alive = await checkExtensionStatus(1_000)
	const lines = [
		`Target: ${targetLabel()}`,
		`  workspaceFolder: ${targetIdentity.workspaceFolder ?? "(unknown)"}`,
		`  focused: ${targetIdentity.focused === true ? "yes" : targetIdentity.focused === false ? "NO — another window has focus" : "(unknown)"}`,
		`  pid: ${targetIdentity.pid ?? "(unknown)"}`,
		`  build: ${targetIdentity.buildTimestamp ?? "(unknown)"}`,
		`  devtool WS: ws://127.0.0.1:${WS_PORT}/ws`,
		`  status HTTP: http://127.0.0.1:${HTTP_STATUS_PORT}/status`,
		`  alive: ${alive ? "yes" : "NO"}`,
	]
	if (targetIdentity.focused === false) {
		lines.push(
			"  (note: window is not focused — harmless for store/console/DOM tools; focus is only needed for type_text keyboard input)",
		)
	}
	return lines.join("\n")
}
