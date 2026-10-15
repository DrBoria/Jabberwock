import { describe, it, expect, vi } from "vitest"
import { CdpConsoleBuffer } from "./buffer.js"

const cdp = (method: string, params: Record<string, unknown> = {}, sessionId?: string) =>
	JSON.stringify({ method, params, ...(sessionId ? { sessionId } : {}) })

describe("CdpConsoleBuffer", () => {
	it("ignores malformed and non-CDP messages", () => {
		const buffer = new CdpConsoleBuffer(() => {})
		buffer.handleWsMessage("not json")
		buffer.handleWsMessage(JSON.stringify({ params: {} }))
		expect(buffer.entries).toHaveLength(0)
	})

	it("maps a webview target to vscode-surface and enables Runtime/Log", () => {
		const sent: string[] = []
		const buffer = new CdpConsoleBuffer((data) => sent.push(data))
		buffer.handleWsMessage(
			cdp("Target.attachedToTarget", { targetInfo: { url: "vscode-webview://host/index.html" } }, "sess-1"),
		)
		expect(buffer.connectedTargets).toEqual(["vscode-surface"])
		expect(sent.map((s) => JSON.parse(s).method).sort()).toEqual(["Log.enable", "Runtime.enable"])
		expect(sent.every((s) => JSON.parse(s).sessionId === "sess-1")).toBe(true)
	})

	it("labels workbench and generic renderer urls", () => {
		const buffer = new CdpConsoleBuffer(() => {})
		buffer.handleWsMessage(
			cdp("Target.attachedToTarget", { targetInfo: { url: "vscode-file://workbench.html" } }, "s1"),
		)
		buffer.handleWsMessage(cdp("Target.attachedToTarget", { targetInfo: { url: "about:blank" } }, "s2"))
		expect(buffer.connectedTargets).toEqual(["workbench", "renderer"])
	})

	it("captures console.log with mixed arg types", () => {
		const buffer = new CdpConsoleBuffer(() => {})
		buffer.handleWsMessage(
			cdp("Runtime.consoleAPICalled", {
				type: "log",
				args: [
					{ value: "hello" },
					{ value: 42 },
					{ unserializableValue: "NaN" },
					{ type: "object", preview: { properties: [{ name: "a" }, { name: "b" }] } },
				],
			}),
		)
		expect(buffer.entries[0]?.text).toBe("hello 42 NaN {a, b}")
		expect(buffer.entries[0]?.target).toBe("renderer")
		expect(buffer.entries[0]?.level).toBe("log")
	})

	it("normalizes warning to warn and unknown levels to log", () => {
		const buffer = new CdpConsoleBuffer(() => {})
		buffer.handleWsMessage(cdp("Runtime.consoleAPICalled", { type: "warning", args: [{ value: "w" }] }))
		buffer.handleWsMessage(cdp("Runtime.consoleAPICalled", { type: "weird", args: [{ value: "x" }] }))
		expect(buffer.entries[0]?.level).toBe("warn")
		expect(buffer.entries[1]?.level).toBe("log")
	})

	it("captures exceptions as error-level entries", () => {
		const buffer = new CdpConsoleBuffer(() => {})
		buffer.handleWsMessage(
			cdp("Runtime.exceptionThrown", {
				exceptionDetails: { text: "Uncaught", exception: { description: "Error: boom" } },
			}),
		)
		expect(buffer.entries[0]).toMatchObject({ level: "error", text: "Error: boom" })
	})

	it("captures Log.entryAdded with the session label", () => {
		const buffer = new CdpConsoleBuffer(() => {})
		buffer.handleWsMessage(cdp("Target.attachedToTarget", { targetInfo: { url: "vscode-webview://x" } }, "s1"))
		buffer.handleWsMessage(cdp("Log.entryAdded", { entry: { level: "warning", text: "webview warn" } }, "s1"))
		expect(buffer.entries[0]).toMatchObject({ target: "vscode-surface", level: "warn", text: "webview warn" })
	})

	it("drops empty text and clears on clear()", () => {
		const buffer = new CdpConsoleBuffer(() => {})
		buffer.handleWsMessage(cdp("Runtime.consoleAPICalled", { type: "log", args: [] }))
		expect(buffer.entries).toHaveLength(0)
		buffer.handleWsMessage(cdp("Log.entryAdded", { entry: { level: "info", text: "keep" } }))
		buffer.clear()
		expect(buffer.entries).toHaveLength(0)
		expect(buffer.connectedTargets).toHaveLength(0)
	})

	it("caps the ring buffer at 3000 entries", () => {
		const buffer = new CdpConsoleBuffer(() => {})
		for (let n = 0; n < 3005; n++) {
			buffer.handleWsMessage(cdp("Log.entryAdded", { entry: { level: "info", text: `m${n}` } }))
		}
		expect(buffer.entries).toHaveLength(3000)
		expect(buffer.entries[0]?.text).toBe("m5")
		expect(buffer.entries[2999]?.text).toBe("m3004")
	})

	it("removes the label on detach and tolerates a closed socket on send", () => {
		const sendFn = vi.fn(() => {
			throw new Error("socket closed")
		})
		const buffer = new CdpConsoleBuffer(sendFn)
		buffer.handleWsMessage(cdp("Target.attachedToTarget", { targetInfo: { url: "vscode-webview://x" } }, "s1"))
		expect(sendFn).toHaveBeenCalledTimes(2)
		buffer.handleWsMessage(cdp("Target.detachedFromTarget", {}, "s1"))
		expect(buffer.connectedTargets).toHaveLength(0)
	})
})
