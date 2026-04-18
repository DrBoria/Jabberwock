import { types } from "mobx-state-tree"

export const Message = types.model("Message", {
	id: types.identifier,
	role: types.optional(types.string, "cline"), // "user", "assistant", or default to "cline"
	content: types.frozen(), // For Anthropic-style multi-block content
	type: types.maybe(types.string), // cline: "say" or "ask"
	say: types.maybe(types.string), // cline: "text", "error", etc.
	ask: types.maybe(types.string), // cline: "tool", "followup", etc.
	text: types.maybe(types.string), // main text content
	partial: types.maybe(types.boolean),
	images: types.optional(types.array(types.string), []),
	ts: types.optional(types.number, () => Date.now()),
})

export const TaskNode = types
	.model("TaskNode", {
		id: types.identifier,
		title: types.string,
		mode: types.maybe(types.string),
		status: types.optional(types.enumeration(["pending", "in_progress", "completed", "failed"]), "pending"),
		messages: types.array(Message),
		uiMessages: types.optional(types.frozen<any[]>(), []), // Store serialized ClineMessage objects
		children: types.array(types.string),
		parentId: types.maybe(types.string),
		rootId: types.maybe(types.string),
	})
	.actions((self) => ({
		addMessage(msg: { id: string; role: string; content: any; ts?: number }) {
			self.messages.push(msg)
		},
		syncUiMessages(uiMessages: any[]) {
			self.uiMessages = uiMessages
		},
		updateStatus(status: "pending" | "in_progress" | "completed" | "failed") {
			self.status = status
		},
		setMode(mode: string) {
			self.mode = mode
		},
		addChild(childId: string) {
			self.children.push(childId)
		},
		replaceMessages(newMessages: { id: string; role: string; content: any; ts?: number }[]) {
			self.messages.replace(newMessages as any)
		},
		addApiMessage(msg: {
			id: string
			role?: string
			content?: any
			text?: string
			partial?: boolean
			ts?: number
		}) {
			self.messages.push(msg as any)
		},
		updateApiMessage(id: string, update: { role?: string; content?: any; text?: string; partial?: boolean }) {
			const msg = self.messages.find((m) => m.id === id)
			if (msg) {
				if (update.role) msg.role = update.role
				if (update.content) msg.content = update.content
				if (update.text !== undefined) msg.text = update.text
				if (update.partial !== undefined) msg.partial = update.partial
			}
		},
	}))

export const ChatStore = types
	.model("ChatStore", {
		nodes: types.map(TaskNode),
		activeNodeId: types.maybe(types.reference(TaskNode)),
	})
	.actions((self) => ({
		createBranch(parentId = "", title = "", id = "") {
			const node = TaskNode.create({
				id,
				title,
				parentId: parentId || undefined,
				messages: [],
				children: [],
			})

			self.nodes.put(node)

			if (parentId && self.nodes.has(parentId)) {
				const parentNode = self.nodes.get(parentId)
				if (parentNode) {
					parentNode.addChild(node.id)
				}
			}

			return node
		},
		switchContext(nodeId = "") {
			if (self.nodes.has(nodeId)) {
				const node = self.nodes.get(nodeId)
				if (node) {
					self.activeNodeId = node
				}
			}
		},
		updateNodeStatus(nodeId = "", newStatus = "pending") {
			const node = self.nodes.get(nodeId)
			if (node) {
				node.status = newStatus
				if (newStatus === "failed") {
					// Rollback should be handled by the task/workspace owner
				} else if (newStatus === "completed") {
					// Commit should be handled by the task/workspace owner
				}
			}
		},
	}))
