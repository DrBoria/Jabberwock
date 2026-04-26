import React from "react"
import { PocketKnife, Split, ArrowRight } from "lucide-react"
import type { ClineMessage, ClineSayTool } from "@jabberwock/types"
import { getModeBySlug } from "@shared/modes"
import { safeJsonParse } from "@shared/core"
import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { toolIcon, TextButton, Container } from "@src/components/ui"
import MarkdownBlock from "../../../common/MarkdownBlock"

interface ToolRendererProps {
	message: ClineMessage
	tool: ClineSayTool
	t: (key: string, options?: any) => string
}

/** Renders switchMode tool */
export const SwitchModeRenderer: React.FC<ToolRendererProps> = ({ message, tool, t }) => {
	const { customModes } = useExtensionState()
	const targetMode = getModeBySlug(tool.mode || "", customModes)
	const targetModeName = targetMode?.name || tool.mode || ""

	return (
		<Container preset="header" p="0">
			<PocketKnife className="w-4 shrink-0" aria-label="Switch mode icon" />
			<span style={{ fontWeight: "bold" }}>
				{message.type === "ask" ? (
					<span
						dangerouslySetInnerHTML={{
							__html: t("chat:modes.wantsToSwitchWithReason", {
								mode: `<code class="font-medium">${targetModeName}</code>`,
								reason: tool.reason,
								interpolation: { escapeValue: false },
							}),
						}}
					/>
				) : (
					<span
						dangerouslySetInnerHTML={{
							__html: t("chat:modes.didSwitchWithReason", {
								mode: `<code class="font-medium">${targetModeName}</code>`,
								reason: tool.reason,
								interpolation: { escapeValue: false },
							}),
						}}
					/>
				)}
			</span>
		</Container>
	)
}

/** Renders newTask tool */
export const NewTaskRenderer: React.FC<ToolRendererProps> = ({ message, tool, t }) => {
	const { clineMessages, currentTaskItem } = useExtensionState()
	const newTaskMessages = clineMessages.filter((msg) => {
		if (msg.type === "ask" && msg.ask === "tool") {
			const parsed = safeJsonParse<ClineSayTool>(msg.text)
			return parsed?.tool === "newTask"
		}
		return false
	})
	const thisNewTaskIndex = newTaskMessages.findIndex((msg) => msg.ts === message.ts)
	const childIds = currentTaskItem?.childIds || []
	const childTaskId =
		thisNewTaskIndex >= 0 && thisNewTaskIndex < childIds.length ? childIds[thisNewTaskIndex] : undefined
	const currentMessageIndex = clineMessages.findIndex((msg) => msg.ts === message.ts)
	const nextMessage = currentMessageIndex >= 0 ? clineMessages[currentMessageIndex + 1] : undefined
	const isFollowedBySubtaskResult = nextMessage?.type === "say" && nextMessage?.say === "subtask_result"

	return (
		<>
			<Container preset="header" p="0">
				<Split className="size-4" />
				<span style={{ fontWeight: "bold" }}>
					<span
						dangerouslySetInnerHTML={{
							__html: t("chat:subtasks.wantsToCreate", {
								mode: `<code class="font-medium">${getModeBySlug(tool.mode || "", [])?.name || tool.mode || ""}</code>`,
								interpolation: { escapeValue: false },
							}),
						}}
					/>
				</span>
			</Container>
			<div className="border-l border-muted-foreground/80 ml-2 pl-4 pb-1">
				<MarkdownBlock markdown={tool.content} />
				<div>
					{childTaskId && !isFollowedBySubtaskResult && (
						<TextButton onClick={() => vscode.postMessage({ type: "showTaskWithId", text: childTaskId })}>
							{t("chat:subtasks.goToSubtask")}
							<ArrowRight className="size-3" />
						</TextButton>
					)}
				</div>
			</div>
		</>
	)
}

/** Renders finishTask tool */
export const FinishTaskRenderer: React.FC<Pick<ToolRendererProps, "t">> = ({ t }) => (
	<>
		<Container preset="header" p="0">
			{toolIcon("check-all")}
			<span style={{ fontWeight: "bold" }}>{t("chat:subtasks.wantsToFinish")}</span>
		</Container>
		<div className="text-muted-foreground pl-6">
			<MarkdownBlock markdown={t("chat:subtasks.completionInstructions")} />
		</div>
	</>
)
