import { describe, expect, it } from "vitest"
import { ChangeLog, SnapshotHistory } from "./mobx/history.js"
import type { StoreChange } from "../types.js"

function change(path: string, action?: string): StoreChange {
	return { path, action, timestamp: Date.now() }
}

describe("SnapshotHistory", () => {
	it("records snapshots oldest-first with incrementing ids", () => {
		const h = new SnapshotHistory()
		h.record({ v: 1 }, "a")
		h.record({ v: 2 }, "b")
		const list = h.list()
		expect(list).toHaveLength(2)
		expect(list[0]?.id).toBe(0)
		expect(list[1]?.id).toBe(1)
		expect(list[1]?.label).toBe("b")
	})

	it("exposes latest and previous", () => {
		const h = new SnapshotHistory()
		expect(h.latest()).toBeUndefined()
		h.record({ v: 1 })
		expect(h.previous()).toBeUndefined()
		h.record({ v: 2 })
		expect(h.latest()?.snapshot).toEqual({ v: 2 })
		expect(h.previous()?.snapshot).toEqual({ v: 1 })
	})

	it("drops the oldest entry beyond capacity", () => {
		const h = new SnapshotHistory(2)
		h.record({ v: 1 })
		h.record({ v: 2 })
		h.record({ v: 3 })
		expect(h.size).toBe(2)
		expect(h.list().map((e) => e.snapshot)).toEqual([{ v: 2 }, { v: 3 }])
	})

	it("clear() resets entries and the id counter", () => {
		const h = new SnapshotHistory()
		h.record({ v: 1 })
		h.clear()
		expect(h.size).toBe(0)
		const entry = h.record({ v: 2 })
		expect(entry.id).toBe(0)
	})
})

describe("ChangeLog", () => {
	it("appends changes oldest-first", () => {
		const log = new ChangeLog()
		log.append(change("a", "x"))
		log.append(change("b", "y"))
		expect(log.list()).toHaveLength(2)
		expect(log.list()[1]?.path).toBe("b")
	})

	it("drops the oldest entry beyond capacity", () => {
		const log = new ChangeLog(2)
		log.append(change("a"))
		log.append(change("b"))
		log.append(change("c"))
		expect(log.size).toBe(2)
		expect(log.list().map((c) => c.path)).toEqual(["b", "c"])
	})

	it("tail() returns newest-first, limited", () => {
		const log = new ChangeLog()
		log.append(change("a"))
		log.append(change("b"))
		log.append(change("c"))
		expect(log.tail(2).map((c) => c.path)).toEqual(["c", "b"])
	})

	it("clear() empties the log", () => {
		const log = new ChangeLog()
		log.append(change("a"))
		log.clear()
		expect(log.size).toBe(0)
	})
})
