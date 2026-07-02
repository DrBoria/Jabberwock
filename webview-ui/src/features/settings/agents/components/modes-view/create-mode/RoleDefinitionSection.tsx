import React from "react"
import { VSCodeTextArea } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@src/i18n/TranslationContext"

interface RoleDefinitionSectionProps {
	value: string
	error: string
	onChange: (value: string) => void
}

export const RoleDefinitionSection: React.FC<RoleDefinitionSectionProps> = ({ value, error, onChange }) => {
	const { t } = useAppTranslation()

	return (
		<div style={{ marginBottom: "16px" }}>
			<div style={{ fontWeight: "bold", marginBottom: "4px" }}>
				{t("prompts:createModeDialog.roleDefinition.label")}
			</div>
			<div
				style={{
					fontSize: "13px",
					color: "var(--vscode-descriptionForeground)",
					marginBottom: "8px",
				}}>
				{t("prompts:createModeDialog.roleDefinition.description")}
			</div>
			<VSCodeTextArea
				resize="vertical"
				value={value}
				onChange={(e) => onChange((e.target as HTMLTextAreaElement).value)}
				rows={4}
				className="w-full"
			/>
			{error && <div className="text-xs text-vscode-errorForeground mt-1">{error}</div>}
		</div>
	)
}
