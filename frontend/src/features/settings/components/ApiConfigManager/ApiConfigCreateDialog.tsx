import { Button } from "@src/shared/ui/buttons/button"
import { Input } from "@src/shared/ui/inputs/input"
import { Dialog, DialogContent, DialogTitle } from "@src/shared/ui/overlays/dialog"

interface ApiConfigCreateDialogProps {
	open: boolean
	newProfileName: string
	error: string | null
	newProfileInputRef: React.RefObject<HTMLElement | null>
	onOpenChange: (open: boolean) => void
	onNameChange: (value: string) => void
	onSave: () => void
	onCancel: () => void
	onClearError: () => void
	t: (key: string) => string
}

export const ApiConfigCreateDialog = ({
	open,
	newProfileName,
	error,
	newProfileInputRef,
	onOpenChange,
	onNameChange,
	onSave,
	onCancel,
	onClearError,
	t,
}: ApiConfigCreateDialogProps) => (
	<Dialog
		open={open}
		onOpenChange={(open: boolean) => {
			if (open) {
				onOpenChange(true)
			} else {
				onCancel()
			}
		}}
		aria-labelledby="new-profile-title">
		<DialogContent className="p-4 max-w-sm bg-card">
			<DialogTitle>{t("settings:providers.newProfile")}</DialogTitle>
			<Input
				ref={newProfileInputRef as React.Ref<HTMLInputElement>}
				value={newProfileName}
				onInput={(e: unknown) => {
					const target = e as { target: { value: string } }
					onNameChange(target.target.value)
					onClearError()
				}}
				placeholder={t("settings:providers.enterProfileName")}
				data-testid="new-profile-input"
				style={{ width: "100%" }}
				onKeyDown={(e: unknown) => {
					const event = e as { key: string }
					if (event.key === "Enter" && newProfileName.trim()) onSave()
					else if (event.key === "Escape") onCancel()
				}}
			/>
			{error && (
				<p className="text-vscode-errorForeground text-sm mt-2" data-testid="error-message">
					{error}
				</p>
			)}
			<div className="flex justify-end gap-2 mt-4">
				<Button variant="secondary" onClick={onCancel} data-testid="cancel-new-profile-button">
					{t("settings:common.cancel")}
				</Button>
				<Button
					variant="primary"
					disabled={!newProfileName.trim()}
					onClick={onSave}
					data-testid="create-profile-button">
					{t("settings:providers.createProfile")}
				</Button>
			</div>
		</DialogContent>
	</Dialog>
)
