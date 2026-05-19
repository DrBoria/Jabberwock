import { describe, it, expect, vi, beforeEach } from "vitest"
import { aggregateTaskCostsRecursive, type TaskCostHistory } from "../../../features/chat/task/utils/aggregateTaskCosts"

describe("aggregateTaskCostsRecursive", () => {
	let consoleWarnSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
	})

	it("should calculate cost for task with no children", async () => {
		const mockHistory: Record<string, TaskCostHistory> = {
			"task-1": {
				totalCost: 1.5,
				childIds: [],
			},
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("task-1", getTaskHistory)

		expect(result.ownCost).toBe(1.5)
		expect(result.childrenCost).toBe(0)
		expect(result.totalCost).toBe(1.5)
		expect(result.childBreakdown).toEqual({})
	})

	it("should handle task without childIds", async () => {
		const mockHistory: Record<string, TaskCostHistory> = {
			"task-1": {
				totalCost: 2.0,
				// childIds is undefined
			},
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("task-1", getTaskHistory)

		expect(result.ownCost).toBe(2.0)
		expect(result.childrenCost).toBe(0)
		expect(result.totalCost).toBe(2.0)
		expect(result.childBreakdown).toEqual({})
	})

	it("should aggregate parent with one child", async () => {
		const mockHistory: Record<string, TaskCostHistory> = {
			parent: {
				totalCost: 1.0,
				childIds: ["child-1"],
			},
			"child-1": {
				totalCost: 0.5,
				childIds: [],
			},
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("parent", getTaskHistory)

		expect(result.ownCost).toBe(1.0)
		expect(result.childrenCost).toBe(0.5)
		expect(result.totalCost).toBe(1.5)
		expect(result.childBreakdown).toHaveProperty("child-1")
		const child1 = result.childBreakdown?.["child-1"]
		expect(child1).toBeDefined()
		expect(child1!.totalCost).toBe(0.5)
	})

	it("should aggregate parent with multiple children", async () => {
		const mockHistory: Record<string, TaskCostHistory> = {
			parent: {
				totalCost: 1.0,
				childIds: ["child-1", "child-2", "child-3"],
			},
			"child-1": {
				totalCost: 0.5,
				childIds: [],
			},
			"child-2": {
				totalCost: 0.75,
				childIds: [],
			},
			"child-3": {
				totalCost: 0.25,
				childIds: [],
			},
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("parent", getTaskHistory)

		expect(result.ownCost).toBe(1.0)
		expect(result.childrenCost).toBe(1.5) // 0.5 + 0.75 + 0.25
		expect(result.totalCost).toBe(2.5)
		expect(Object.keys(result.childBreakdown || {})).toHaveLength(3)
	})

	it("should recursively aggregate multi-level hierarchy", async () => {
		const mockHistory: Record<string, TaskCostHistory> = {
			parent: {
				totalCost: 1.0,
				childIds: ["child"],
			},
			child: {
				totalCost: 0.5,
				childIds: ["grandchild"],
			},
			grandchild: {
				totalCost: 0.25,
				childIds: [],
			},
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("parent", getTaskHistory)

		expect(result.ownCost).toBe(1.0)
		expect(result.childrenCost).toBe(0.75) // child (0.5) + grandchild (0.25)
		expect(result.totalCost).toBe(1.75)

		// Verify child breakdown
		const child = result.childBreakdown?.["child"]
		expect(child).toBeDefined()
		expect(child!.ownCost).toBe(0.5)
		expect(child!.childrenCost).toBe(0.25)
		expect(child!.totalCost).toBe(0.75)

		// Verify grandchild breakdown
		const grandchild = child!.childBreakdown?.["grandchild"]
		expect(grandchild).toBeDefined()
		expect(grandchild!.ownCost).toBe(0.25)
		expect(grandchild!.childrenCost).toBe(0)
		expect(grandchild!.totalCost).toBe(0.25)
	})

	it("should detect and prevent circular references", async () => {
		const mockHistory: Record<string, TaskCostHistory> = {
			"task-a": {
				totalCost: 1.0,
				childIds: ["task-b"],
			},
			"task-b": {
				totalCost: 0.5,
				childIds: ["task-a"], // Circular reference back to task-a
			},
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("task-a", getTaskHistory)

		// Should still process task-b but ignore the circular reference
		expect(result.ownCost).toBe(1.0)
		expect(result.childrenCost).toBe(0.5) // Only task-b's own cost, circular ref returns 0
		expect(result.totalCost).toBe(1.5)

		// Verify warning was logged
		expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Circular reference detected: task-a"))
	})

	it("should handle missing task gracefully", async () => {
		const mockHistory: Record<string, TaskCostHistory> = {
			parent: {
				totalCost: 1.0,
				childIds: ["nonexistent-child"],
			},
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("parent", getTaskHistory)

		expect(result.ownCost).toBe(1.0)
		expect(result.childrenCost).toBe(0) // Missing child contributes 0
		expect(result.totalCost).toBe(1.0)

		// Verify warning was logged
		expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Task nonexistent-child not found"))
	})

	it("should return zero costs for completely missing task", async () => {
		const mockHistory: Record<string, TaskCostHistory> = {}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("nonexistent", getTaskHistory)

		expect(result.ownCost).toBe(0)
		expect(result.childrenCost).toBe(0)
		expect(result.totalCost).toBe(0)

		expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Task nonexistent not found"))
	})

	it("should handle task with null totalCost", async () => {
		const mockHistory: Record<string, TaskCostHistory> = {
			"task-1": {
				totalCost: null as unknown as number, // Explicitly null (invalid type in prod)
				childIds: [],
			},
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("task-1", getTaskHistory)

		expect(result.ownCost).toBe(0)
		expect(result.childrenCost).toBe(0)
		expect(result.totalCost).toBe(0)
	})

	it("should handle task with undefined totalCost", async () => {
		const mockHistory: Record<string, TaskCostHistory> = {
			"task-1": {
				// totalCost is undefined
				childIds: [],
			},
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("task-1", getTaskHistory)

		expect(result.ownCost).toBe(0)
		expect(result.childrenCost).toBe(0)
		expect(result.totalCost).toBe(0)
	})

	it("should handle complex hierarchy with mixed costs", async () => {
		const mockHistory: Record<string, TaskCostHistory> = {
			root: {
				totalCost: 2.5,
				childIds: ["child-1", "child-2"],
			},
			"child-1": {
				totalCost: 1.2,
				childIds: ["grandchild-1", "grandchild-2"],
			},
			"child-2": {
				totalCost: 0.8,
				childIds: [],
			},
			"grandchild-1": {
				totalCost: 0.3,
				childIds: [],
			},
			"grandchild-2": {
				totalCost: 0.15,
				childIds: [],
			},
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("root", getTaskHistory)

		expect(result.ownCost).toBe(2.5)
		// child-1: 1.2 + 0.3 + 0.15 = 1.65
		// child-2: 0.8
		// Total children: 2.45
		expect(result.childrenCost).toBe(2.45)
		expect(result.totalCost).toBe(4.95) // 2.5 + 2.45
	})

	it("should handle siblings without cross-contamination", async () => {
		const mockHistory: Record<string, TaskCostHistory> = {
			parent: {
				totalCost: 1.0,
				childIds: ["sibling-1", "sibling-2"],
			},
			"sibling-1": {
				totalCost: 0.5,
				childIds: ["nephew"],
			},
			"sibling-2": {
				totalCost: 0.3,
				childIds: ["nephew"], // Same child ID as sibling-1
			},
			nephew: {
				totalCost: 0.1,
				childIds: [],
			},
		}

		const getTaskHistory = vi.fn(async (id: string) => mockHistory[id])

		const result = await aggregateTaskCostsRecursive("parent", getTaskHistory)

		// Both siblings should independently count nephew
		// sibling-1: 0.5 + 0.1 = 0.6
		// sibling-2: 0.3 + 0.1 = 0.4
		// Total: 1.0 + 0.6 + 0.4 = 2.0
		expect(result.totalCost).toBe(2.0)
	})
})
