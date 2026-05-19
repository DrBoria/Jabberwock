import { types, Instance } from "mobx-state-tree"

export const Message = types.model("Message", {
	id: types.identifier,
	role: types.string, // "user", "assistant", or default to "cline"
	content: types.frozen(), // For Anthropic-style multi-block content
	type: types.optional(types.string, ""), // cline: "say" or "ask"
	say: types.optional(types.string, ""), // cline: "text", "error", etc.
	ask: types.optional(types.string, ""), // cline: "tool", "followup", etc.
	text: types.optional(types.string, ""), // main text content
	partial: types.optional(types.boolean, false),
	images: types.optional(types.array(types.string), []),
	ts: types.optional(types.number, 0),
})

export const TaskNode = types
	.model("TaskNode", {
		id: types.identifier,
		title: types.string,
		mode: types.string,
		status: types.enumeration(["pending", "in_progress", "completed", "failed"]),
		messages: types.array(Message),
		uiMessages: types.frozen<unknown[]>(), // Store serialized ClineMessage objects
		children: types.array(types.string),
		parentId: types.string,
		rootId: types.string,
	})
	.actions((self) => ({
		addMessage(msg: { id: string; role: string; content: unknown; ts?: number }) {
			self.messages.push(msg as never)
		},
		syncUiMessages(uiMessages: unknown[]) {
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
		replaceMessages(newMessages: { id: string; role: string; content: unknown; ts?: number }[]) {
			self.messages.replace(newMessages as never)
		},
		addApiMessage(msg: {
			id: string
			role?: string
			content?: unknown
			text?: string
			partial?: boolean
			ts?: number
		}) {
			self.messages.push(msg as never)
		},
		updateApiMessage(id: string, update: { role?: string; content?: unknown; text?: string; partial?: boolean }) {
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
		activeNodeId: types.safeReference(TaskNode),
	})
	.actions((self) => ({
		createBranch(parentId = "", title = "", id = "") {
			const node = TaskNode.create({
				id,
				title,
				mode: "",
				status: "pending",
				uiMessages: [],
				parentId,
				rootId: "",
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

export type ChatStoreType = Instance<typeof ChatStore>
