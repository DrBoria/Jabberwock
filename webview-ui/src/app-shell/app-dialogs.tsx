import React from "react"
import { rootStore } from "@src/features/store"
import { CheckpointRestoreDialog } from "@src/features/chat/task/notifications/checkpoint/restore-dialog"
import {
	DeleteMessageDialog,
	EditMessageDialog,
} from "@src/features/chat/task/notifications/message-modification-confirmation-dialog"
import type { DeleteMessageDialogState, EditMessageDialogState } from "./app-types"

const MemoizedDeleteMessageDialog = React.memo(DeleteMessageDialog)
const MemoizedEditMessageDialog = React.memo(EditMessageDialog)
const MemoizedCheckpointRestoreDialog = React.memo(CheckpointRestoreDialog)

interface AppDialogsProps {
	deleteMessageDialogState: DeleteMessageDialogState
	editMessageDialogState: EditMessageDialogState
	onDeleteDialogOpenChange: (open: boolean) => void
	onEditDialogOpenChange: (open: boolean) => void
}

export const AppDialogs: React.FC<AppDialogsProps> = ({
	deleteMessageDialogState: d,
	editMessageDialogState: e,
	onDeleteDialogOpenChange: od,
	onEditDialogOpenChange: oe,
}) => (
	<>
		{d.hasCheckpoint ? (
			<MemoizedCheckpointRestoreDialog
				open={d.isOpen}
				type="delete"
				hasCheckpoint={d.hasCheckpoint}
				onOpenChange={od}
				onConfirm={(r: boolean) => {
					rootStore.chat.confirmDeleteMessage(d.messageTs, r)
					od(false)
				}}
			/>
		) : (
			<MemoizedDeleteMessageDialog
				open={d.isOpen}
				onOpenChange={od}
				onConfirm={() => {
					rootStore.chat.confirmDeleteMessage(d.messageTs)
					od(false)
				}}
			/>
		)}
		{e.hasCheckpoint ? (
			<MemoizedCheckpointRestoreDialog
				open={e.isOpen}
				type="edit"
				hasCheckpoint={e.hasCheckpoint}
				onOpenChange={oe}
				onConfirm={(r: boolean) => {
					rootStore.chat.confirmEditMessage(e.messageTs, e.text, r)
					oe(false)
				}}
			/>
		) : (
			<MemoizedEditMessageDialog
				open={e.isOpen}
				onOpenChange={oe}
				onConfirm={() => {
					rootStore.chat.confirmEditMessage(e.messageTs, e.text, undefined, e.images)
					oe(false)
				}}
			/>
		)}
	</>
)
