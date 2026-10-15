import { describe, it, expect } from "vitest"
import { MessageInterceptor } from "./index.js"

describe("MessageInterceptor", () => {
	it("intercepts a send message when type and action match", () => {
		const i = new MessageInterceptor()
		i.set({ direction: "send", type: "action", action: "click", response: { ok: 1 } })
		const result = i.sendMessage({ type: "action", action: "click" })
		expect(result.intercepted).toBe(true)
		expect(result.response).toEqual({ ok: 1 })
	})

	it("intercepts with a wildcard action but not a different action", () => {
		const i = new MessageInterceptor()
		i.set({ direction: "send", type: "action", response: { wild: true } })
		expect(i.sendMessage({ type: "action", action: "anything" }).intercepted).toBe(true)
		const other = new MessageInterceptor()
		other.set({ direction: "send", type: "action", action: "click" })
		expect(other.sendMessage({ type: "action", action: "hover" }).intercepted).toBe(false)
	})

	it("does not intercept receives with a send interceptor and vice versa", () => {
		const i = new MessageInterceptor()
		i.set({ direction: "send", type: "action", action: "click" })
		expect(i.receiveMessage({ type: "action", action: "click" }).intercepted).toBe(false)
		i.set({ direction: "receive", type: "action", action: "click" })
		expect(i.sendMessage({ type: "action", action: "click" }).intercepted).toBe(true)
		expect(i.receiveMessage({ type: "action", action: "click" }).intercepted).toBe(true)
	})

	it("remove deletes only the exact match and reports success", () => {
		const i = new MessageInterceptor()
		i.set({ direction: "send", type: "action", action: "a" })
		i.set({ direction: "send", type: "action" })
		expect(i.remove("send", "action", "a")).toBe(true)
		expect(i.getActive()).toHaveLength(1)
		expect(i.remove("send", "action", "a")).toBe(false)
	})

	it("removeMany removes wildcard and exact matches", () => {
		const i = new MessageInterceptor()
		i.set({ direction: "send", type: "action", action: "a" })
		i.set({ direction: "send", type: "action", action: "b" })
		i.set({ direction: "send", type: "action" })
		i.set({ direction: "receive", type: "action", action: "a" })
		expect(i.removeMany("send", "action", "a")).toBe(1)
		expect(i.removeMany("send", "action")).toBe(2)
		expect(i.getActive()).toHaveLength(1)
	})

	it("clear removes all interceptors", () => {
		const i = new MessageInterceptor()
		i.set({ direction: "send", type: "a" })
		i.set({ direction: "receive", type: "b" })
		i.clear()
		expect(i.getActive()).toHaveLength(0)
	})

	it("records a trace entry only for intercepted messages", () => {
		const i = new MessageInterceptor()
		i.set({ direction: "send", type: "action", action: "click" })
		i.sendMessage({ type: "action", action: "click" })
		i.sendMessage({ type: "action", action: "other" })
		const { entries, totalCount } = i.getTrace()
		expect(totalCount).toBe(1)
		expect(entries[0]).toMatchObject({ direction: "send", type: "action", action: "click", intercepted: true })
	})

	it("getTrace filters by direction, type and action", () => {
		const i = new MessageInterceptor()
		i.set({ direction: "send", type: "action", action: "a" })
		i.set({ direction: "receive", type: "action", action: "a" })
		i.set({ direction: "send", type: "command", action: "b" })
		i.sendMessage({ type: "action", action: "a" })
		i.receiveMessage({ type: "action", action: "a" })
		i.sendMessage({ type: "command", action: "b" })
		expect(i.getTrace({ direction: "send" }).totalCount).toBe(2)
		expect(i.getTrace({ type: "command" }).entries[0]?.action).toBe("b")
		expect(i.getTrace({ action: "a" }).totalCount).toBe(2)
	})

	it("getTrace limit returns the oldest-first tail", () => {
		const i = new MessageInterceptor()
		i.set({ direction: "send", type: "action" })
		i.sendMessage({ type: "action", action: "first" })
		i.sendMessage({ type: "action", action: "second" })
		i.sendMessage({ type: "action", action: "third" })
		const { entries, totalCount } = i.getTrace(undefined, 2)
		expect(totalCount).toBe(3)
		expect(entries.map((e) => e.action)).toEqual(["second", "third"])
	})

	it("trims the trace to the most recent 1000 entries", () => {
		const i = new MessageInterceptor()
		i.set({ direction: "send", type: "action" })
		for (let n = 0; n < 1002; n++) i.sendMessage({ type: "action", action: `m${n}` })
		const { entries, totalCount } = i.getTrace()
		expect(totalCount).toBe(1000)
		expect(entries[0]?.action).toBe("m2")
		expect(entries[999]?.action).toBe("m1001")
	})

	it("clearTrace empties the trace but keeps interceptors", () => {
		const i = new MessageInterceptor()
		i.set({ direction: "send", type: "action" })
		i.sendMessage({ type: "action", action: "x" })
		i.clearTrace()
		expect(i.getTrace().totalCount).toBe(0)
		expect(i.getActive()).toHaveLength(1)
	})
})
