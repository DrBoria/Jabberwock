import { types, applySnapshot } from "mobx-state-tree"

export const Message = types.model("Message", {
	id: types.identifier,
	role: types.optional(types.string, "cline"), // "user", "assistant", or default to "cline"
	content: types.frozen(), // For Anthropic-style multi-block content
	type: types.maybe(types.string), // cline: "say" or "ask"
	say: types.maybe(types.string), // cline: "text", "error", etc.
	ask: types.maybe(types.string), // cline: "tool", "followup", etc.
	text: types.maybe(types.string), // main text content or summary
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
		uiMessages: types.optional(types.frozen<any[]>(), []),
		children: types.array(types.string),
		parentId: types.maybe(types.string),
		rootId: types.maybe(types.string),
	})
	.actions((self) => ({
		replaceMessages(newMessages: any[]) {
			self.messages.replace(newMessages)
		},
		syncUiMessages(uiMessages: any[]) {
			self.uiMessages = uiMessages
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
	.views((self) => ({
		get depth(): number {
			let d = 0
			let current = self.parentId
			const nodes = (self as any).$treenode.parent.nodes
			while (current && nodes && nodes.has && nodes.has(current)) {
				d++
				current = nodes.get(current)?.parentId
			}
			return d
		},
		get childTasks() {
			const nodes = (self as any).$treenode.parent.nodes
			if (!nodes || !nodes.get) return []
			return self.children.map((id) => nodes.get(id)).filter(Boolean)
		},
	}))

export const ChatStore = types
	.model("ChatStore", {
		nodes: types.map(TaskNode),
		activeNodeId: types.maybe(types.reference(TaskNode)),
		isNavigating: types.optional(types.boolean, false),
	})
	.actions((self) => ({
		applyTreeSnapshot(snapshot: any) {
			applySnapshot(self, snapshot)
			self.isNavigating = false
		},
		setNavigating(val: boolean) {
			self.isNavigating = val
		},
		navigateToNode(_id: string) {
			self.isNavigating = true
			// The actual VSCode message will be sent from the component
			// but we set the state here immediately to buffer the UI.
		},
	}))
	.views((self) => ({
		get activeHierarchy() {
			if (!self.activeNodeId) return []
			const path: any[] = []
			// MST resolves references automatically, so currentNode is a TaskNode
			let currentNode: any = self.activeNodeId
			while (currentNode) {
				path.unshift(currentNode)
				currentNode = currentNode.parentId ? self.nodes.get(currentNode.parentId) : undefined
			}
			return path
		},
	}))

export const chatTreeStore = ChatStore.create({ nodes: {} })
