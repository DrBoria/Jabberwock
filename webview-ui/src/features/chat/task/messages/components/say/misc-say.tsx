import React from "react"
import { Check } from "lucide-react"
import type { Notification } from "@jabberwock/types"
import { safeJsonParse } from "@jabberwock/core/browser"
import { observer } from "mobx-react-lite"
import { rootStore } from "@src/features/store"
import { Markdown } from "../message-parts/markdown"
import { OpenMarkdownPreviewButton } from "../message-parts/open-markdown-preview-button"
import { WarningRow } from "../row/warning-row"
import { CheckpointSaved } from "../../../notifications/checkpoint/saved"
import CodebaseSearchResultsDisplay from "@src/features/settings/agents/indexing/code-search/codebase-search/results-display"
import UpdateTodoListToolBlock from "../../../../topic/update-todo-list-tool-block"
import { InProgressRow } from "../row/context-rows/in-progress-row"
import { CondensationResultRow } from "../row/context-rows/condensation-result-row"
import { CondensationErrorRow } from "../row/context-rows/condensation-error-row"
import { TruncationResultRow } from "../row/context-rows/truncation-result-row"
import MarkdownBlock from "@src/features/foundation/components/markdown/MarkdownBlock"
import ImageBlock from "@src/features/foundation/components/image/ImageBlock"
import { Container } from "@src/shared/ui/layouts/Container"

/* ── SubtaskResult ── */
interface SubtaskResultProps {
	message: Notification
	t: (key: string, options?: Record<string, unknown>) => string
}

export const SubtaskResultSay: React.FC<SubtaskResultProps> = observer(({ message, t }) => {
	const currentTaskItem = rootStore.extensionState.currentTaskItem
	const completedChildTaskId = currentTaskItem?.completedByChildId
	return (
		<div className="border-l border-muted-foreground/80 ml-2 pl-4 pt-2 pb-1 -mt-5">
			<Container $preset="header" $p="0">
				<span style={{ fontWeight: "bold" }}>{t("chat:subtasks.resultContent")}</span>
				<Check className="size-3" />
			</Container>
			<MarkdownBlock markdown={message.text} />
			{completedChildTaskId && (
				<button
					className="cursor-pointer flex gap-1 items-center mt-2 text-vscode-descriptionForeground hover:text-vscode-descriptionForeground hover:underline font-normal"
					onClick={() => rootStore.chat.navigateToTask(completedChildTaskId)}>
					{t("chat:subtasks.goToSubtask")}
					<Check className="size-3" />
				</button>
			)}
		</div>
	)
})

/* ── CompletionResult ── */
interface CompletionResultProps {
	message: Notification
	icon: React.ReactNode
	title: React.ReactNode
}

export const CompletionResultSay: React.FC<CompletionResultProps> = ({ message, icon, title }) => (
	<div className="group">
		<Container $preset="header" $p="0">
			{icon}
			{title}
			<OpenMarkdownPreviewButton markdown={message.text} />
		</Container>
		<div className="border-l border-green-600/30 ml-2 pl-4 pb-1">
			<Markdown markdown={message.text} />
		</div>
	</div>
)

/* ── Image ── */
interface ImageProps {
	message: Notification
}

export const ImageSay: React.FC<ImageProps> = ({ message }) => {
	const imageInfo = safeJsonParse<{ imageUri: string; imagePath: string }>(message.text || "{}")
	if (!imageInfo) return null
	return (
		<div style={{ marginTop: "10px" }}>
			<ImageBlock imageUri={imageInfo.imageUri} imagePath={imageInfo.imagePath} />
		</div>
	)
}

/* ── TooManyToolsWarning ── */
interface TooManyToolsWarningProps {
	message: Notification
	t: (key: string, options?: Record<string, unknown>) => string
}

export const TooManyToolsWarningSay: React.FC<TooManyToolsWarningProps> = ({ message, t }) => {
	const warningData = safeJsonParse<{ toolCount: number; serverCount: number; threshold: number }>(
		message.text || "{}",
	)
	if (!warningData) return null
	const toolsPart = t("chat:tooManyTools.toolsPart", { count: warningData.toolCount })
	const serversPart = t("chat:tooManyTools.serversPart", { count: warningData.serverCount })
	return (
		<WarningRow
			title={t("chat:tooManyTools.title")}
			message={t("chat:tooManyTools.messageTemplate", {
				tools: toolsPart,
				servers: serversPart,
				threshold: warningData.threshold,
			})}
			actionText={t("chat:tooManyTools.openMcpSettings")}
			onAction={() =>
				window.postMessage({ type: "action", action: "settingsButtonClicked", values: { section: "mcp" } }, "*")
			}
		/>
	)
}

/* ── CheckpointSaved ── */
interface CheckpointSavedProps {
	message: Notification
}

export const CheckpointSavedSay: React.FC<CheckpointSavedProps> = observer(({ message }) => {
	const currentCheckpoint = rootStore.currentCheckpoint
	return (
		<CheckpointSaved
			ts={message.ts!}
			commitHash={message.text!}
			currentHash={currentCheckpoint}
			checkpoint={message.checkpoint}
		/>
	)
})

/* ── CodebaseSearchResult ── */
interface CodebaseSearchResultProps {
	message: Notification
}

export const CodebaseSearchResultSay: React.FC<CodebaseSearchResultProps> = ({ message }) => {
	let parsed: {
		content?: {
			results?: Array<{
				filePath: string
				score: number
				startLine: number
				endLine: number
				codeChunk: string
			}>
		}
	} | null = null
	try {
		if (message.text) parsed = JSON.parse(message.text)
	} catch (error) {
		console.error("[jabberwock] Failed to parse codebaseSearch content:", error)
	}
	if (parsed && !parsed?.content) {
		console.error("[jabberwock] Invalid codebaseSearch content structure:", parsed.content)
		return <div>Error displaying search results.</div>
	}
	const results: Array<{
		filePath: string
		score: number
		startLine: number
		endLine: number
		codeChunk: string
	}> = parsed?.content?.results ?? []
	return <CodebaseSearchResultsDisplay results={results} />
}

/* ── UpdateTodoList ── */
interface UpdateTodoListProps {
	message: Notification
}

export const UpdateTodoListSay: React.FC<UpdateTodoListProps> = () => {
	return <UpdateTodoListToolBlock userEdited onChange={() => {}} />
}

/* ── CondenseContext ── */
interface CondenseContextProps {
	message: Notification
}

export const CondenseContextSay: React.FC<CondenseContextProps> = ({ message }) => {
	if (message.partial) return <InProgressRow eventType="condense_context" />
	if (message.contextCondense) return <CondensationResultRow data={message.contextCondense} />
	return null
}

interface SlidingWindowTruncationProps {
	message: Notification
}

export const SlidingWindowTruncationSay: React.FC<SlidingWindowTruncationProps> = ({ message }) => {
	if (message.partial) return <InProgressRow eventType="sliding_window_truncation" />
	if (message.contextTruncation) return <TruncationResultRow data={message.contextTruncation} />
	return null
}

interface CondensationErrorProps {
	message: Notification
}

export const CondensationErrorSay: React.FC<CondensationErrorProps> = ({ message }) => {
	return <CondensationErrorRow errorText={message.text} />
}
