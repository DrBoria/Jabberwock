/**
 * Phase 1 Test: MST ChatTreeStore Implementation
 *
 * This test validates the Conversation Tree Architecture (CTA) implementation
 * as specified in new-way.md Phase 1.
 */

import { describe, it, expect } from "vitest"
import { getSnapshot } from "mobx-state-tree"
import { ChatStore, Message, TaskNode } from "../ChatTreeStore"

describe("Phase 1: MST ChatTreeStore (Conversation Tree Architecture)", () => {
	it("creates root branch and adds messages", () => {
		const store = ChatStore.create({ nodes: {} })

		// Create root task node
		const rootNode = store.createBranch(undefined, "Root Task", "root-1")

		expect(store.nodes.size).toBe(1)
		expect(rootNode.title).toBe("Root Task")
		expect(rootNode.status).toBe("pending")
		expect(rootNode.messages.length).toBe(0)

		// Add messages to the root node
		rootNode.addMessage({
			id: "msg-1",
			role: "user",
			content: { text: "Hello, agent!" },
			ts: Date.now(),
		})

		expect(rootNode.messages.length).toBe(1)
		expect(rootNode.messages[0].role).toBe("user")
	})

	it("creates child branches and maintains parent-child relationships", () => {
		const store = ChatStore.create({ nodes: {} })

		// Create root task
		const rootNode = store.createBranch(undefined, "Parent Task", "parent-1")

		// Create child task under root
		const childNode = store.createBranch("parent-1", "Child Task", "child-1")

		expect(store.nodes.size).toBe(2)
		expect(childNode.parentId).toBe("parent-1")
		expect(rootNode.children.length).toBe(1)
		expect(rootNode.children[0]).toBe("child-1")

		// Create grandchild
		const grandChildNode = store.createBranch("child-1", "Grandchild Task", "grandchild-1")

		expect(store.nodes.size).toBe(3)
		expect(grandChildNode.parentId).toBe("child-1")
		expect(childNode.children.length).toBe(1)
	})

	it("switches context between branches correctly", () => {
		const store = ChatStore.create({ nodes: {} })

		store.createBranch(undefined, "Task A", "task-a")
		store.createBranch(undefined, "Task B", "task-b")
		store.createBranch(undefined, "Task C", "task-c")

		expect(store.nodes.size).toBe(3)

		// Switch to Task B
		store.switchContext("task-b")
		expect(store.activeNodeId?.id).toBe("task-b")

		// Switch to Task A
		store.switchContext("task-a")
		expect(store.activeNodeId?.id).toBe("task-a")

		// Switch to non-existent node (should not change active)
		store.switchContext("non-existent")
		expect(store.activeNodeId?.id).toBe("task-a")
	})

	it("produces normalized MST snapshot structure", () => {
		const store = ChatStore.create({ nodes: {} })

		const rootNode = store.createBranch(undefined, "Root", "root-1")
		rootNode.addMessage({ id: "m1", role: "user", content: { text: "Test" } })

		const childNode = store.createBranch("root-1", "Child", "child-1")
		childNode.addMessage({ id: "m2", role: "assistant", content: { text: "Response" } })

		const snapshot = getSnapshot(store)

		// Verify normalized structure (nodes in map, children store only IDs)
		expect(snapshot.nodes).toBeDefined()
		expect(Object.keys(snapshot.nodes).length).toBe(2)

		// Root node should have child reference as ID string
		expect(snapshot.nodes["root-1"].children).toEqual(["child-1"])

		// Child node should have parentId as string
		expect(snapshot.nodes["child-1"].parentId).toBe("root-1")

		// Messages should be arrays in snapshot
		expect(Array.isArray(snapshot.nodes["root-1"].messages)).toBe(true)
		expect(snapshot.nodes["root-1"].messages.length).toBe(1)
	})

	it("updates node status correctly", () => {
		const store = ChatStore.create({ nodes: {} })

		const node = store.createBranch(undefined, "Test Task", "test-1")

		expect(node.status).toBe("pending")

		node.updateStatus("in_progress")
		expect(node.status).toBe("in_progress")

		node.updateStatus("completed")
		expect(node.status).toBe("completed")

		node.updateStatus("failed")
		expect(node.status).toBe("failed")
	})

	it("replaces messages array completely", () => {
		const store = ChatStore.create({ nodes: {} })

		const node = store.createBranch(undefined, "Test Task", "test-1")

		node.addMessage({ id: "m1", role: "user", content: { text: "First" } })
		node.addMessage({ id: "m2", role: "assistant", content: { text: "Second" } })

		expect(node.messages.length).toBe(2)

		// Replace with new messages
		node.replaceMessages([{ id: "m3", role: "user", content: { text: "New message" } }])

		expect(node.messages.length).toBe(1)
		expect(node.messages[0].id).toBe("m3")
	})

	it("handles multiple children for same parent", () => {
		const store = ChatStore.create({ nodes: {} })

		const rootNode = store.createBranch(undefined, "Root Task", "root-1")

		store.createBranch("root-1", "Child 1", "child-1")
		store.createBranch("root-1", "Child 2", "child-2")
		store.createBranch("root-1", "Child 3", "child-3")

		expect(rootNode.children.length).toBe(3)
		expect(rootNode.children).toContain("child-1")
		expect(rootNode.children).toContain("child-2")
		expect(rootNode.children).toContain("child-3")
	})

	it("isolates messages between branches", () => {
		const store = ChatStore.create({ nodes: {} })

		const nodeA = store.createBranch(undefined, "Task A", "task-a")
		const nodeB = store.createBranch(undefined, "Task B", "task-b")

		nodeA.addMessage({ id: "msg-a1", role: "user", content: { text: "Message for A" } })
		nodeA.addMessage({ id: "msg-a2", role: "assistant", content: { text: "Response for A" } })

		nodeB.addMessage({ id: "msg-b1", role: "user", content: { text: "Message for B" } })

		// Messages should be isolated
		expect(nodeA.messages.length).toBe(2)
		expect(nodeB.messages.length).toBe(1)

		// Adding message to A shouldn't affect B
		nodeA.addMessage({ id: "msg-a3", role: "user", content: { text: "Another for A" } })

		expect(nodeA.messages.length).toBe(3)
		expect(nodeB.messages.length).toBe(1) // Still 1, isolated!
	})

	it("sets mode on task nodes", () => {
		const store = ChatStore.create({ nodes: {} })

		const node = store.createBranch(undefined, "Test Task", "test-1")

		expect(node.mode).toBeUndefined()

		node.setMode("coder")
		expect(node.mode).toBe("coder")

		node.setMode("designer")
		expect(node.mode).toBe("designer")
	})
})
