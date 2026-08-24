import React, { useState } from "react"
import { observer } from "mobx-react-lite"
import * as Collapsible from "@radix-ui/react-collapsible"
import { ChevronRight, ChevronDown, Bot, ListTree, X } from "lucide-react"
import { cn } from "@src/lib/utils"

import { useChatTree } from "@src/features/chat/tree/store"
import { rootStore } from "@src/features/store"
import { useWindowManager } from "@src/features/foundation/window-manager/store"
import ChatRow from "../row/view"
import { Notification } from "@jabberwock/types"
import { Instance } from "mobx-state-tree"
import { TaskNode } from "@src/features/chat/tree/store"

type TaskNodeType = Instance<typeof TaskNode>

interface ChatTreeNodeProps {
	node: TaskNodeType
	depth: number
	isRoot?: boolean
}

const ChatTreeRootLayer = observer(({ node, depth }: { node: TaskNodeType; depth: number }) => {
	const store = useChatTree()

	return (
		<div className="flex flex-col">
			<div className="flex flex-col">
				{node.children.map((childId) => {
					const childNode = store.nodes.get(childId)
					if (childNode) return <ChatTreeNode key={childId} node={childNode} depth={depth + 1} />
					return null
				})}
			</div>
		</div>
	)
})

const ChatTreeCollapsibleNode = observer(({ node, depth }: { node: TaskNodeType; depth: number }) => {
	const [isOpen, setIsOpen] = useState(true)
	const store = useChatTree()
	const { pushWindow: _pushWindow } = useWindowManager()
	const messages = (node.uiMessages || []) as Notification[]

	const stackOffset = depth * 4
	const opacity = Math.max(0.7, 1 - depth * 0.05)

	return (
		<div
			className="depth-layer animate-task-stack-in relative w-full mb-4"
			style={{
				marginTop: depth > 1 ? "-20px" : "16px",
				zIndex: 10 + depth,
				opacity: opacity,
			}}>
			<Collapsible.Root
				open={isOpen}
				onOpenChange={setIsOpen}
				className="bg-[var(--vscode-editor-background)] border border-[var(--vscode-editorGroup-border)] rounded-xl overflow-hidden shadow-2xl"
				style={{
					transform: `translateY(${stackOffset}px) scale(${1 - depth * 0.01})`,
					boxShadow: `0 ${depth * 4}px ${depth * 8}px rgba(0,0,0,0.3)`,
				}}>
				<div className="flex items-center justify-between px-3 py-2.5 bg-[var(--vscode-sideBarSectionHeader-background)] border-b border-[var(--vscode-editorGroup-border)]">
					<div
						className="flex items-center gap-2 cursor-pointer hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded p-1 transition-colors"
						onClick={() => _pushWindow("chat", { targetNodeId: node.id })}>
						<div className="p-1 bg-[var(--vscode-badge-background)] rounded-md">
							<Bot size={14} className="text-[var(--vscode-badge-foreground)]" />
						</div>
						<div className="flex flex-col">
							<span className="text-[11px] font-bold uppercase tracking-widest text-[var(--vscode-sideBarTitle-foreground)]">
								{node.mode || "Agent"}
								<span className="ml-2 font-normal lowercase opacity-70">({node.status})</span>
							</span>
							<span className="text-[10px] opacity-60 truncate max-w-[200px]">{node.title}</span>
						</div>
					</div>
					<div className="flex items-center gap-1">
						<Collapsible.Trigger asChild>
							<button className="p-1 hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded transition-colors cursor-pointer border-none bg-transparent text-[var(--vscode-foreground)]">
								{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
							</button>
						</Collapsible.Trigger>
					</div>
				</div>

				<Collapsible.Content className="p-1 bg-[var(--vscode-editor-background)]">
					<div className="max-h-[500px] overflow-y-auto scrollable px-2 py-2">
						{messages.map((msg, idx) => (
							<ChatRow
								key={msg.ts || idx}
								message={msg}
								history={messages}
								isLast={idx === messages.length - 1}
								onHeightChange={() => {}}
								isNested={true}
							/>
						))}

						<div className="mt-4">
							{node.children.map((childId) => {
								const childNode = store.nodes.get(childId)
								if (childNode) return <ChatTreeNode key={childId} node={childNode} depth={depth + 1} />
								return null
							})}
						</div>
					</div>
				</Collapsible.Content>
			</Collapsible.Root>
		</div>
	)
})

const ChatTreeNode = observer(({ node, depth, isRoot }: ChatTreeNodeProps) => {
	if (depth === 0 || isRoot) {
		return <ChatTreeRootLayer node={node} depth={depth} />
	}

	return <ChatTreeCollapsibleNode node={node} depth={depth} />
})

function findRootNode(store: ReturnType<typeof useChatTree>): TaskNodeType | undefined {
	const currentTaskItem = rootStore.extensionState.currentTaskItem
	if (!currentTaskItem?.id) return undefined

	let currentNode = store.nodes.get(currentTaskItem.id)
	while (currentNode?.parentId) {
		const parent = store.nodes.get(currentNode.parentId)
		if (!parent) break
		currentNode = parent
	}
	return currentNode ?? undefined
}

const LoadingOverlay: React.FC = () => (
	<div className="absolute inset-0 flex items-center justify-center z-50">
		<div className="flex flex-col items-center gap-2 bg-vscode-editor-background/80 p-4 rounded-xl shadow-xl border border-vscode-editorGroup-border backdrop-blur-sm">
			<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-vscode-button-background"></div>
			<span className="text-xs font-medium">Navigating...</span>
		</div>
	</div>
)

const EmptyState: React.FC = () => (
	<div className="flex flex-col items-center justify-center h-full opacity-50 p-8 text-center">
		<Bot size={48} className="mb-4" />
		<p className="text-sm font-medium">No active conversation hierarchy found.</p>
		<p className="text-xs mt-1">Start a new task or open an existing one from history.</p>
	</div>
)

export const ChatTreeViewer = observer(() => {
	const store = useChatTree()
	const { popWindow } = useWindowManager()
	const rootNode = findRootNode(store)
	const rootNodes: TaskNodeType[] = rootNode ? [rootNode] : []

	return (
		<div className="flex flex-col h-full bg-vscode-editor-background">
			<div className="p-3 border-b border-vscode-editorGroup-border flex items-center justify-between bg-vscode-sideBar-background/50 backdrop-blur-md">
				<div className="flex items-center gap-2">
					<ListTree size={16} className="text-vscode-foreground" />
					<span className="text-xs font-bold uppercase tracking-widest opacity-80">
						Conversation Hierarchy
					</span>
				</div>
				<button
					onClick={() => popWindow()}
					className="p-1 hover:bg-vscode-toolbar-hoverBackground rounded flex items-center justify-center transition-colors border-none bg-transparent text-vscode-foreground/60 hover:text-vscode-foreground">
					<X size={16} />
				</button>
			</div>

			<div
				className={cn(
					"grow flex flex-col w-full overflow-y-auto scrollable p-4 gap-6 relative",
					store.isNavigating && "opacity-60 pointer-events-none transition-opacity",
				)}>
				{store.isNavigating && <LoadingOverlay />}
				{rootNodes.map((node) => (
					<ChatTreeNode key={node.id} node={node} depth={1} isRoot={true} />
				))}
				{rootNodes.length === 0 && !store.isNavigating && <EmptyState />}
			</div>
		</div>
	)
})
