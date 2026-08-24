import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/shared/ui/buttons/button"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@src/shared/ui/overlays/dialog"

interface DeleteServerDialogProps {
	open: boolean
	serverName: string
	onOpenChange: (open: boolean) => void
	onDelete: () => void
}

export const DeleteServerDialog = ({ open, serverName, onOpenChange, onDelete }: DeleteServerDialogProps) => {
	const { t } = useAppTranslation()
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("mcp:deleteDialog.title")}</DialogTitle>
					<DialogDescription>{t("mcp:deleteDialog.description", { serverName })}</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="secondary" onClick={() => onOpenChange(false)}>
						{t("mcp:deleteDialog.cancel")}
					</Button>
					<Button variant="primary" onClick={onDelete}>
						{t("mcp:deleteDialog.delete")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
