import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { Button } from "@src/shared/ui/buttons/button"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"

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
}: ApiConfigRenameFormProps) => (
	<div data-testid="rename-form">
		<div className="flex items-center gap-1">
			<VSCodeTextField
				ref={inputRef as never}
				value={inputValue}
				onInput={(e: unknown) => {
					const target = e as { target: { value: string } }
					onInputChange(target.target.value)
					onClearError()
				}}
				placeholder={t("settings:providers.enterNewName")}
				onKeyDown={({ key }: { key: string }) => {
					if (key === "Enter" && inputValue.trim()) onSave()
					else if (key === "Escape") onCancel()
				}}
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
