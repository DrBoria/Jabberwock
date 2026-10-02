import React from "react"
import { VSCodeTextArea, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/shared/ui/buttons/button-primitive"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard"
import { getEventValue } from "@src/utils/helpers/getEventValue"

interface PromptInputProps {
	value: string
	isTextArea?: boolean
	rows?: number
	testId?: string
	onChange: (value: string) => void
}

/** Text input / textarea with the shared change-event extraction. */
export const PromptInput: React.FC<PromptInputProps> = ({ value, isTextArea, rows, testId, onChange }) => {
	if (isTextArea) {
		return (
			<VSCodeTextArea
				resize="vertical"
				value={value}
				onChange={(e) => {
					const v = getEventValue(e) ?? ""
					onChange(v)
				}}
				className="w-full"
				rows={rows ?? 5}
				data-testid={testId}
			/>
		)
	}

	return (
		<VSCodeTextField
			value={value}
			onChange={(e) => {
				const v = getEventValue(e) ?? ""
				onChange(v)
			}}
			className="w-full"
			data-testid={testId}
		/>
	)
}

type PromptFieldProps = {
	label: string
	description: string | React.ReactNode
	isCustomMode: boolean
	value: string
	isTextArea?: boolean
	rows?: number
	testId?: string
	onChange: (value: string) => void
	onReset: () => void
}

export const PromptFieldSection: React.FC<PromptFieldProps> = ({
	label,
	description,
	isCustomMode,
	value,
	isTextArea,
	rows,
	testId,
	onChange,
	onReset,
}) => {
	const { t } = useAppTranslation()

	return (
		<div className="mb-4">
			<div className="flex justify-between items-center mb-1">
				<div className="font-bold">{label}</div>
				{!isCustomMode && (
					<StandardTooltip content={t("prompts:roleDefinition.resetToDefault")}>
						<Button
							variant="ghost"
							size="icon"
							onClick={onReset}
							data-testid={testId ? `${testId}-reset` : undefined}>
							<span className="codicon codicon-discard" />
						</Button>
					</StandardTooltip>
				)}
			</div>
			<div className="text-sm text-vscode-descriptionForeground mb-2">{description}</div>
			<PromptInput value={value} isTextArea={isTextArea} rows={rows} testId={testId} onChange={onChange} />
		</div>
	)
}
