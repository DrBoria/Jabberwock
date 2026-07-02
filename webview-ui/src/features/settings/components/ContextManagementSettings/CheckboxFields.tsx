import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { SearchableSetting } from "../shared/SearchableSetting"
import type { ContextManagementCachedField } from "./types"
import { getCheckboxChecked } from "./helpers"

interface CheckboxField {
	settingId: string
	field: ContextManagementCachedField
	labelKey: string
	descKey: string
	checked: boolean
}

interface CheckboxFieldsProps {
	showJabberwockIgnoredFiles?: boolean
	enableSubfolderRules?: boolean
	includeDiagnosticMessages?: boolean
	includeCurrentTime?: boolean
	includeCurrentCost?: boolean
	onChange: (field: ContextManagementCachedField, value: boolean) => void
}

export const CheckboxFields = ({
	showJabberwockIgnoredFiles,
	enableSubfolderRules,
	includeDiagnosticMessages,
	includeCurrentTime,
	includeCurrentCost,
	onChange,
}: CheckboxFieldsProps) => {
	const { t } = useAppTranslation()
	const fields: CheckboxField[] = [
		{
			settingId: "context-show-rooignored-files",
			field: "showJabberwockIgnoredFiles",
			labelKey: "settings:contextManagement.jabberwockignore.label",
			descKey: "settings:contextManagement.jabberwockignore.description",
			checked: !!showJabberwockIgnoredFiles,
		},
		{
			settingId: "context-enable-subfolder-rules",
			field: "enableSubfolderRules",
			labelKey: "settings:contextManagement.enableSubfolderRules.label",
			descKey: "settings:contextManagement.enableSubfolderRules.description",
			checked: !!enableSubfolderRules,
		},
		{
			settingId: "context-include-diagnostic-messages",
			field: "includeDiagnosticMessages",
			labelKey: "settings:contextManagement.diagnostics.includeMessages.label",
			descKey: "settings:contextManagement.diagnostics.includeMessages.description",
			checked: !!includeDiagnosticMessages,
		},
		{
			settingId: "context-include-current-time",
			field: "includeCurrentTime",
			labelKey: "settings:contextManagement.includeCurrentTime.label",
			descKey: "settings:contextManagement.includeCurrentTime.description",
			checked: !!includeCurrentTime,
		},
		{
			settingId: "context-include-current-cost",
			field: "includeCurrentCost",
			labelKey: "settings:contextManagement.includeCurrentCost.label",
			descKey: "settings:contextManagement.includeCurrentCost.description",
			checked: !!includeCurrentCost,
		},
	]
	return (
		<>
			{fields.map(({ settingId, field, labelKey, descKey, checked }) => (
				<SearchableSetting
					key={settingId}
					settingId={settingId}
					section="contextManagement"
					label={t(labelKey)}>
					<VSCodeCheckbox
						checked={checked}
						onChange={(e) => onChange(field, getCheckboxChecked(e))}
						data-testid={`${settingId}-checkbox`}>
						<label className="block font-medium mb-1">{t(labelKey)}</label>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm mt-1 mb-3">{t(descKey)}</div>
				</SearchableSetting>
			))}
		</>
	)
}
