import { useCallback } from "react"

import { Button } from "../ui/button"
import { StandardTooltip } from "../ui/standard-tooltip"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { WINDOW_MANAGER_DELETE_TASK_WITH_ID as _WINDOW_MANAGER_DELETE_TASK_WITH_ID } from "@jabberwock/types"
import { rootStore } from "@src/features/store"

type DeleteButtonProps = {
	itemId: string
	onDelete?: (taskId: string) => void
}

export const DeleteButton = ({ itemId, onDelete }: DeleteButtonProps) => {
	const { t } = useAppTranslation()

	const handleDeleteClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			if (e.shiftKey) {
				rootStore.history.deleteTaskWithId(itemId)
			} else if (onDelete) {
				onDelete(itemId)
			}
		},
		[itemId, onDelete],
	)

	return (
		<StandardTooltip content={t("history:deleteTaskTitle")}>
			<Button
				variant="ghost"
				size="icon"
				data-testid="delete-task-button"
				onClick={handleDeleteClick}
				className="group-hover:opacity-100 opacity-50 transition-opacity">
				<span className="codicon codicon-trash scale-80" />
			</Button>
		</StandardTooltip>
	)
}
