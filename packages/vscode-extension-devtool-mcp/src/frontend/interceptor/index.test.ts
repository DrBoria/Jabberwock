import { describe, it, expect, vi } from "vitest"
import { createFrontendInterceptor } from "./index.js"

describe("FrontendMessageInterceptor", () => {
	it("delivers the message to the backend when no interceptor matches", () => {
		const post = vi.fn()
		const interceptor = createFrontendInterceptor(post)
		const result = interceptor.send({ type: "action", action: "findElement" })
		expect(result.intercepted).toBe(false)
		expect(post).toHaveBeenCalledWith({ type: "action", action: "findElement" })
	})

	it("short-circuits a matching send interceptor and does not post", () => {
		const post = vi.fn()
		const interceptor = createFrontendInterceptor(post)
		interceptor.set({ direction: "send", type: "action", action: "findElement", response: { stub: true } })
		const result = interceptor.send({ type: "action", action: "findElement" })
		expect(result.intercepted).toBe(true)
		expect(result.response).toEqual({ stub: true })
		expect(post).not.toHaveBeenCalled()
	})

	it("records a trace entry for intercepted sends", () => {
		const post = vi.fn()
		const interceptor = createFrontendInterceptor(post)
		interceptor.set({ direction: "send", type: "action", action: "click" })
		interceptor.send({ type: "action", action: "click" })
		const { entries, totalCount } = interceptor.getTrace()
		expect(totalCount).toBe(1)
		expect(entries[0]?.direction).toBe("send")
		expect(entries[0]?.type).toBe("action")
	})

	it("getTracePage returns newest-first with pagination", () => {
		const post = vi.fn()
		const interceptor = createFrontendInterceptor(post)
		interceptor.set({ direction: "send", type: "action", action: "a" })
		interceptor.set({ direction: "send", type: "action", action: "b" })
		interceptor.send({ type: "action", action: "a" })
		interceptor.send({ type: "action", action: "b" })
		const page = interceptor.getTracePage(undefined, 1, 0)
		expect(page.totalCount).toBe(2)
		expect(page.entries).toHaveLength(1)
		// Newest-first: the most recent send ("b") comes first.
		expect(page.entries[0]?.action).toBe("b")
	})
})
