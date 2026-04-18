import { describe, it, expect, vi, beforeEach } from "vitest"
import { DiagnosticsManager } from "../core/devtools/DiagnosticsManager"
import { Tracer } from "../core/devtools/Tracer"

// Mock vscode and other node dependencies
vi.mock("vscode", () => ({
	Uri: {
		joinPath: vi.fn().mockReturnValue({ fsPath: "/mock/log/path" }),
	},
}))

vi.mock("fs", () => ({
	mkdirSync: vi.fn(),
	appendFileSync: vi.fn(),
	writeFileSync: vi.fn(),
	existsSync: vi.fn().mockReturnValue(true),
	readFileSync: vi.fn().mockReturnValue(""),
}))

describe("Diagnostics Structured Observability", () => {
	let tracer: Tracer
	let logs: string[] = []

	beforeEach(() => {
		logs = []
		tracer = new Tracer((msg) => logs.push(msg))
	})

	describe("Tracer Lifecycle", () => {
		it("should record task lifecycle with nesting", () => {
			tracer.recordTaskStart("task-1", "primary", "Hello Task")
			const toolId = tracer.recordToolStart("task-1", "read_file", { path: "test.ts" })

			const traces = tracer.getTraces()
			expect(traces.taskTraces[0].id).toBe("task-1")
			expect(traces.taskTraces[0].toolCalls).toContain(toolId)
			expect(traces.toolTraces[toolId].toolName).toBe("read_file")

			tracer.recordToolEnd(toolId, "success")
			tracer.recordTaskEnd("task-1", "completed")

			const finalTraces = tracer.getTraces()
			expect(finalTraces.taskTraces[0].status).toBe("completed")
			expect(finalTraces.taskTraces[0].durationMs).toBeGreaterThanOrEqual(0)
			expect(finalTraces.toolTraces[toolId].status).toBe("success")
		})

		it("should redact sensitive parameters during sanitization", () => {
			const toolId = tracer.recordToolStart("task-1", "execute", {
				apiKey: "secret-123",
				nested: { password: "p1" },
				normal: "value",
			})

			const traces = tracer.getTraces()
			expect(traces.toolTraces[toolId].params.apiKey).toBe("********")
			expect(traces.toolTraces[toolId].params.nested.password).toBe("********")
			expect(traces.toolTraces[toolId].params.normal).toBe("value")
		})

		it("should truncate long strings in parameters", () => {
			const longStr = "a".repeat(1000)
			const toolId = tracer.recordToolStart("task-1", "write", { content: longStr })

			const traces = tracer.getTraces()
			expect(traces.toolTraces[toolId].params.content.length).toBeLessThan(1000)
			expect(traces.toolTraces[toolId].params.content).toContain("[truncated]")
		})

		it("should detect identical parameter cycles", () => {
			tracer.recordTaskStart("task-loop", "primary", "Looping")

			// Call same tool with same params 3 times
			for (let i = 0; i < 3; i++) {
				const tid = tracer.recordToolStart("task-loop", "ls", { path: "." })
				tracer.recordToolEnd(tid, "success")
			}

			const warningLogs = logs.filter((l) => l.includes("Potential Cycle Detected"))
			expect(warningLogs.length).toBeGreaterThan(0)
			expect(warningLogs[0]).toContain("ls")
		})
	})

	describe("DiagnosticsManager Integration", () => {
		it("should aggregate snapshots from all sub-managers", () => {
			const manager = new DiagnosticsManager()
			manager.recordTaskStart("t1", "primary", "test")
			manager.recordMetric("m1", 100, "success")
			manager.log("Log 1", "info")

			const snapshot = manager.getSnapshot()
			expect(snapshot.taskTraces.length).toBe(1)
			expect(snapshot.metrics.length).toBe(1)
			expect(snapshot.logs.length).toBeGreaterThan(0)
			expect(snapshot.currentAction).toBe("Log 1")
		})

		it("should clear all data on clear()", () => {
			const manager = new DiagnosticsManager()
			manager.recordTaskStart("t1", "primary", "test")
			manager.clear()

			const snapshot = manager.getSnapshot()
			expect(snapshot.taskTraces.length).toBe(0)
			expect(snapshot.metrics.length).toBe(0)
		})
	})
})
