import { Button } from "@src/shared/ui/buttons/button-primitive"
import { Input } from "@src/shared/ui/inputs/input"
import { Dialog, DialogContent, DialogTitle } from "@src/shared/ui/overlays/dialog"
import { makeConfigInputHandler, makeConfigKeydownHandler } from "./api-config-input-events"

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
}: ApiConfigCreateDialogProps) => {
	const handleInput = makeConfigInputHandler(onNameChange, onClearError)
	const handleKeyDown = makeConfigKeydownHandler(newProfileName, onSave, onCancel)

	return (
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
					onInput={handleInput}
					placeholder={t("settings:providers.enterProfileName")}
					data-testid="new-profile-input"
					style={{ width: "100%" }}
					onKeyDown={handleKeyDown}
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
}
