import React from "react"
import { Container } from "@src/features/foundation/ui/Container"
import { Activity } from "lucide-react"

interface ParentContextPanelProps {
	parentNode?: {
		messages?: { role?: string; text?: string; content?: unknown; ts?: number }[]
	}
}

/**
 * Displays inherited parent context when viewing a nested (subtask) conversation.
 * Shows the parent task's raw messages in a collapsed info panel.
 */
export const ParentContextPanel: React.FC<ParentContextPanelProps> = ({ parentNode }) => {
	if (!parentNode) return null

	return (
		<div id="parent-conversation-context" className="mt-4 pt-4 border-t border-vscode-sideBar-border opacity-60">
			<Container className="text-[10px] uppercase font-bold tracking-wider mb-2 text-vscode-descriptionForeground flex items-center gap-1">
				<Activity size={10} /> Inherited Parent Context
			</Container>
			<Container className="flex flex-col gap-1 max-h-[300px] overflow-y-auto pr-2">
				{(parentNode.messages || []).map(
					(msg: { ts?: number; role?: string; text?: string; content?: unknown }, i: number) => (
						<div
							key={`${msg.ts}-${i}`}
							className="text-[11px] font-mono whitespace-pre-wrap break-words p-1 rounded bg-vscode-editor-background">
							<span className="opacity-50 mr-1">[{msg.role}]</span>
							{msg.text || (msg.content !== undefined ? JSON.stringify(msg.content) : "")}
						</div>
					),
				)}
			</Container>
		</div>
	)
}
