import React, { useState } from "react"
import { observer } from "mobx-react-lite"
import * as Collapsible from "@radix-ui/react-collapsible"
import { ChevronRight, ChevronDown, Bot } from "lucide-react"

import { useChatTree } from "../../context/ChatTreeContext"
import ChatRow from "./ChatRow"
import { ClineMessage } from "@jabberwock/types"
import { Instance } from "mobx-state-tree"
import { TaskNode } from "../../state/ChatTreeStore"

type TaskNodeType = Instance<typeof TaskNode>

interface ChatTreeNodeProps {
	node: TaskNodeType
	depth: number
}

// Ensure ChatRow receives a stable object where possible, though ChatRow is heavy.
const ChatTreeNode = observer(({ node, depth }: ChatTreeNodeProps) => {
	const [isOpen, setIsOpen] = useState(true)
	const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({})
	const store = useChatTree()

	// The node.uiMessages holds the ClineMessage[]
	const messages: ClineMessage[] = node.uiMessages || []

	if (depth === 0) {
		return (
			<div className="flex flex-col">
				{node.children.map((childId) => {
					const childNode = store.nodes.get(childId)
					if (childNode) return <ChatTreeNode key={childId} node={childNode} depth={depth + 1} />
					return null
				})}
			</div>
		)
	}

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
					<div className="flex items-center gap-2">
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
								isExpanded={expandedRows[msg.ts] || false}
								isLast={idx === messages.length - 1}
								isStreaming={false}
								onToggleExpand={(ts) => setExpandedRows((prev) => ({ ...prev, [ts]: !prev[ts] }))}
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

export const ChatTreeViewer = observer(() => {
	const store = useChatTree()

	// Find root node (the one matching the active task ID or having no parent)
	// Usually there's only one root task active per workspace in Jabberwock
	const rootNodes: TaskNodeType[] = []
	store.nodes.forEach((node) => {
		if (!node.parentId) rootNodes.push(node)
	})

	return (
		<div className="flex flex-col w-full h-full overflow-y-auto">
			{rootNodes.map((node) => (
				<ChatTreeNode key={node.id} node={node} depth={0} />
			))}
		</div>
	)
})
