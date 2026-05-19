import React from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"

interface TodoListSettingsControlProps {
	todoListEnabled?: boolean
	onChange: (field: "todoListEnabled", value: boolean) => void
}

export const TodoListSettingsControl: React.FC<TodoListSettingsControlProps> = ({
	todoListEnabled = true,
	onChange,
}) => {
	const { t } = useAppTranslation()

	return (
		<div className="flex flex-col gap-1">
			<div>
				<VSCodeCheckbox
					checked={todoListEnabled}
					onChange={(e) => onChange("todoListEnabled", (e.target as HTMLInputElement).checked)}>
					<span className="font-medium">{t("settings:advanced.todoList.label")}</span>
				</VSCodeCheckbox>
				<div className="text-vscode-descriptionForeground text-sm">
					{t("settings:advanced.todoList.description")}
				</div>
			</div>
		</div>
	)
}
