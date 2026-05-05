import React from "react"
import { Activity } from "lucide-react"
import { Container } from "@src/components/ui/Container"

export interface ParentContextPanelProps {
	parentNode: { messages: Array<{ ts: number; role?: string; text?: string; content?: any }> } | undefined
}

/**
 * Displays inherited parent context for subtasks.
 * Shows parent messages in a compact, scrollable panel.
 */
export const ParentContextPanel: React.FC<ParentContextPanelProps> = ({ parentNode }) => {
	if (!parentNode) return null

	return (
		<div
			id="parent-conversation-context"
			className="mt-4 pt-4 border-t border-vscode-sideBar-border opacity-60"
			data-testid="parent-conversation-context">
			<Container className="text-[10px] uppercase font-bold tracking-wider mb-2 text-vscode-descriptionForeground flex items-center gap-1">
				<Activity size={10} />
				Inherited Parent Context
			</Container>
			<Container className="flex flex-col gap-1 max-h-[300px] overflow-y-auto pr-2">
				{parentNode.messages.map((msg: any, i: number) => (
					<div
						key={`${msg.ts}-${i}`}
						data-testid="parent-message"
						data-role={msg.role}
						className="text-[11px] font-mono whitespace-pre-wrap break-words p-1 rounded bg-vscode-editor-background">
						<span className="opacity-50 mr-1">[{msg.role}]</span>
						{msg.text || (msg.content && JSON.stringify(msg.content))}
					</div>
				))}
			</Container>
		</div>
	)
}
