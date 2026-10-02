import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { Button } from "@src/shared/ui/buttons/button-primitive"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard"
import { makeConfigInputHandler, makeConfigKeydownHandler } from "./api-config-input-events"

interface ApiConfigRenameFormProps {
	inputValue: string
	error: string | null
	inputRef: React.RefObject<HTMLElement | null>
	onInputChange: (value: string) => void
	onSave: () => void
	onCancel: () => void
	onClearError: () => void
	t: (key: string) => string
}

export const ApiConfigRenameForm = ({
	inputValue,
	error,
	inputRef,
	onInputChange,
	onSave,
	onCancel,
	onClearError,
	t,
}: ApiConfigRenameFormProps) => {
	const handleInput = makeConfigInputHandler(onInputChange, onClearError)
	const handleKeyDown = makeConfigKeydownHandler(inputValue, onSave, onCancel)

	return (
		<div data-testid="rename-form">
			<div className="flex items-center gap-1">
				<VSCodeTextField
					ref={inputRef as never}
					value={inputValue}
					onInput={handleInput}
					placeholder={t("settings:providers.enterNewName")}
					onKeyDown={handleKeyDown}
					className="grow"
				/>
				<StandardTooltip content={t("settings:common.save")}>
					<Button
						variant="ghost"
						size="icon"
						disabled={!inputValue.trim()}
						onClick={onSave}
						data-testid="save-rename-button">
						<span className="codicon codicon-check" />
					</Button>
				</StandardTooltip>
				<StandardTooltip content={t("settings:common.cancel")}>
					<Button variant="ghost" size="icon" onClick={onCancel} data-testid="cancel-rename-button">
						<span className="codicon codicon-close" />
					</Button>
				</StandardTooltip>
			</div>
			{error && (
				<div className="text-vscode-descriptionForeground text-sm mt-1" data-testid="error-message">
					{error}
				</div>
			)}
		</div>
	)
}
