import React from "react"
import { PocketKnife, Split, ArrowRight } from "lucide-react"
import type { Notification, SayToolData } from "@jabberwock/types"
import { getModeBySlug } from "@shared/modes"
import { safeJsonParse } from "@jabberwock/core/browser"
import { rootStore } from "@src/features/store"
import { observer } from "mobx-react-lite"
import { TextButton } from "@src/shared/ui/buttons/TextButton"
import { toolIcon } from "@src/shared/ui/icons/toolIcon"
import { Container } from "@src/shared/ui/layouts/Container"
import MarkdownBlock from "@src/features/foundation/components/markdown/MarkdownBlock"

interface ToolRendererProps {
	message: Notification
	tool: SayToolData
	t: (key: string, options?: Record<string, unknown>) => string
}

/** Renders switchMode tool */
export const SwitchModeRenderer: React.FC<ToolRendererProps> = observer(({ message, tool, t }) => {
	const customModes = rootStore.extensionState.customModes
	const targetMode = getModeBySlug(tool.mode || "", customModes)
	const targetModeName = targetMode?.name || tool.mode || ""

	return (
		<Container $preset="header" $p="0">
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
})

function getNewTaskModeName(tool: SayToolData): string {
	const slug = tool.mode ?? ""
	const mode = getModeBySlug(slug, [])
	return mode?.name ?? slug
}

interface NewTaskSubtaskButtonProps {
	childTaskId: string
	t: (key: string, options?: Record<string, unknown>) => string
}

const NewTaskSubtaskButton: React.FC<NewTaskSubtaskButtonProps> = ({ childTaskId, t }) => (
	<div>
		<TextButton onClick={() => rootStore.chat.navigateToTask(childTaskId)}>
			{t("chat:subtasks.goToSubtask")}
			<ArrowRight className="size-3" />
		</TextButton>
	</div>
)

interface NewTaskHeaderProps {
	tool: SayToolData
	t: (key: string, options?: Record<string, unknown>) => string
}

const NewTaskHeader: React.FC<NewTaskHeaderProps> = ({ tool, t }) => {
	const modeName = getNewTaskModeName(tool)
	return (
		<Container $preset="header" $p="0">
			<Split className="size-4" />
			<span style={{ fontWeight: "bold" }}>
				<span
					dangerouslySetInnerHTML={{
						__html: t("chat:subtasks.wantsToCreate", {
							mode: `<code class="font-medium">${modeName}</code>`,
							interpolation: { escapeValue: false },
						}),
					}}
				/>
			</span>
		</Container>
	)
}

/** Renders newTask tool */
export const NewTaskRenderer: React.FC<ToolRendererProps> = observer(({ message, tool, t }) => {
	const messages = rootStore.extensionState.messages
	const currentTaskItem = rootStore.extensionState.currentTaskItem
	const childTaskId = findChildTaskId(messages, currentTaskItem, message)
	const isFollowedBySubtaskResult = isFollowedBySubtaskResultMsg(messages, message)

	return (
		<>
			<NewTaskHeader tool={tool} t={t} />
			<div className="border-l border-muted-foreground/80 ml-2 pl-4 pb-1">
				<MarkdownBlock markdown={tool.content} />
				{childTaskId && !isFollowedBySubtaskResult && <NewTaskSubtaskButton childTaskId={childTaskId} t={t} />}
			</div>
		</>
	)
})

function findChildTaskId(
	messages: Notification[],
	currentTaskItem: { childIds?: string[] } | null | undefined,
	message: Notification,
): string | undefined {
	const newTaskMessages = messages.filter((msg) => {
		if (msg.type === "ask" && msg.ask === "tool") {
			const parsed = safeJsonParse<SayToolData>(msg.text)
			return parsed?.tool === "newTask"
		}
		return false
	})
	const thisNewTaskIndex = newTaskMessages.findIndex((msg) => msg.ts === message.ts)
	const childIds = currentTaskItem?.childIds ?? []
	if (thisNewTaskIndex >= 0 && thisNewTaskIndex < childIds.length) {
		return childIds[thisNewTaskIndex]
	}
	return undefined
}

function isFollowedBySubtaskResultMsg(messages: Notification[], message: Notification): boolean {
	const currentMessageIndex = messages.findIndex((msg) => msg.ts === message.ts)
	if (currentMessageIndex < 0) return false
	const nextMessage = messages[currentMessageIndex + 1]
	if (!nextMessage) return false
	return nextMessage.type === "say" && nextMessage.say === "subtask_result"
}

/** Renders finishTask tool */
export const FinishTaskRenderer: React.FC<Pick<ToolRendererProps, "t">> = ({ t }) => (
	<>
		<Container $preset="header" $p="0">
			{toolIcon("check-all")}
			<span style={{ fontWeight: "bold" }}>{t("chat:subtasks.wantsToFinish")}</span>
		</Container>
		<div className="text-muted-foreground pl-6">
			<MarkdownBlock markdown={t("chat:subtasks.completionInstructions")} />
		</div>
	</>
)
