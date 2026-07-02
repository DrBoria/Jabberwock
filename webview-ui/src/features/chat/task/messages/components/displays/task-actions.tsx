import { useState } from "react"
import { useTranslation } from "react-i18next"

import type { HistoryItem } from "@jabberwock/types"

import { rootStore } from "@src/features/store"
import { useCopyToClipboard } from "@sections/dndTextArea/utils/clipboard/clipboard"
import { observer } from "mobx-react-lite"

import { DeleteTaskDialog } from "@src/features/history/components/dialogs/DeleteTaskDialog"
import { ShareButton } from "@sections/dndTextArea/share-button"
import { CopyIcon, CheckIcon, DownloadIcon, Trash2Icon, FileJsonIcon, MessageSquareCodeIcon } from "lucide-react"
import { IconButton } from "@src/shared/ui/buttons/icon-button"

interface TaskActionsProps {
	item?: HistoryItem
	buttonsDisabled: boolean
}

const DebugButtonGroup = observer(() => {
	const debug = rootStore.extensionState.debug
	const { t } = useTranslation()

	if (!debug) {
		return null
	}
	return (
		<>
			<IconButton
				icon={FileJsonIcon}
				title={t("chat:task.openApiHistory")}
				data-testid="task-actions-debug-api"
				onClick={() => rootStore.settings.openDebugApiHistory()}
			/>
			<IconButton
				icon={MessageSquareCodeIcon}
				title={t("chat:task.openUiHistory")}
				data-testid="task-actions-debug-ui"
				onClick={() => rootStore.settings.openDebugUiHistory()}
			/>
		</>
	)
})

export const TaskActions = observer(({ item, buttonsDisabled }: TaskActionsProps) => {
	const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)
	const { t } = useTranslation()
	const { copyWithFeedback, showCopyFeedback } = useCopyToClipboard()

	return (
		<div className="flex flex-row items-center -ml-0.5 mt-1 gap-1">
			<IconButton
				icon={DownloadIcon}
				title={t("chat:task.export")}
				data-testid="task-actions-export"
				onClick={() => rootStore.history.exportCurrentTask()}
			/>

			{item?.task && (
				<IconButton
					icon={showCopyFeedback ? CheckIcon : CopyIcon}
					title={t("history:copyPrompt")}
					data-testid="task-actions-copy"
					onClick={(e) => copyWithFeedback(item.task, e)}
				/>
			)}
			{!!item?.size && item.size > 0 && (
				<>
					<IconButton
						icon={Trash2Icon}
						title={t("chat:task.delete")}
						data-testid="task-actions-delete"
						disabled={buttonsDisabled}
						onClick={(e) => {
							e.stopPropagation()
							if (e.shiftKey) {
								rootStore.history.deleteTaskWithId(item.id)
							} else {
								setDeleteTaskId(item.id)
							}
						}}
					/>
					{deleteTaskId && (
						<DeleteTaskDialog
							taskId={deleteTaskId}
							onOpenChange={(open) => !open && setDeleteTaskId(null)}
							open
						/>
					)}
				</>
			)}
			<ShareButton item={item} disabled={false} />
			<DebugButtonGroup />
		</div>
	)
})
