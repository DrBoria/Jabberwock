import { types, applySnapshot } from "mobx-state-tree"

export const Message = types.model("Message", {
	id: types.identifier,
	role: types.string,
	content: types.frozen(),
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
	})
	.actions((self) => ({
		replaceMessages(newMessages: any[]) {
			self.messages.replace(newMessages)
		},
		syncUiMessages(uiMessages: any[]) {
			self.uiMessages = uiMessages
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
