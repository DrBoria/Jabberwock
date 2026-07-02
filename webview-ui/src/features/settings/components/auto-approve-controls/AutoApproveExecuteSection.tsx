import { useState } from "react"
import { X } from "lucide-react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Button } from "@src/shared/ui/buttons/button"
import { Input } from "@src/shared/ui/inputs/input"
import { rootStore } from "@src/features/store"
import { SearchableSetting } from "../shared/SearchableSetting"
import type { SetCachedStateField } from "../shared/types"

type AutoApproveExecuteSectionProps = {
	allowedCommands?: string[]
	deniedCommands?: string[]
	setCachedStateField: SetCachedStateField<"allowedCommands" | "deniedCommands">
}

export const AutoApproveExecuteSection = ({
	allowedCommands,
	deniedCommands,
	setCachedStateField,
}: AutoApproveExecuteSectionProps) => {
	const { t } = useAppTranslation()
	const [commandInput, setCommandInput] = useState("")
	const [deniedCommandInput, setDeniedCommandInput] = useState("")

	const handleAddCommand = () => {
		const currentCommands = allowedCommands ?? []
		if (commandInput && !currentCommands.includes(commandInput)) {
			const newCommands = [...currentCommands, commandInput]
			setCachedStateField("allowedCommands", newCommands)
			setCommandInput("")
			rootStore.settings.updateSettings({ allowedCommands: newCommands })
		}
	}

	const handleAddDeniedCommand = () => {
		const currentCommands = deniedCommands ?? []
		if (deniedCommandInput && !currentCommands.includes(deniedCommandInput)) {
			const newCommands = [...currentCommands, deniedCommandInput]
			setCachedStateField("deniedCommands", newCommands)
			setDeniedCommandInput("")
			rootStore.settings.updateSettings({ deniedCommands: newCommands })
		}
	}

	return (
		<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
			<div className="flex items-center gap-4 font-bold">
				<span className="codicon codicon-terminal" />
				<div>{t("settings:autoApprove.execute.label")}</div>
			</div>
			<SearchableSetting
				settingId="auto-approve-allowed-commands"
				section="autoApprove"
				label={t("settings:autoApprove.execute.allowedCommands")}>
				<label className="block font-medium mb-1" data-testid="allowed-commands-heading">
					{t("settings:autoApprove.execute.allowedCommands")}
				</label>
				<div className="text-vscode-descriptionForeground text-sm mt-1">
					{t("settings:autoApprove.execute.allowedCommandsDescription")}
				</div>
			</SearchableSetting>
			<div className="flex gap-2">
				<Input
					value={commandInput}
					onChange={(e) => setCommandInput((e.target as HTMLInputElement).value)}
					onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
						if (e.key === "Enter") {
							e.preventDefault()
							handleAddCommand()
						}
					}}
					placeholder={t("settings:autoApprove.execute.commandPlaceholder")}
					className="grow"
					data-testid="command-input"
				/>
				<Button className="h-8" onClick={handleAddCommand} data-testid="add-command-button">
					{t("settings:autoApprove.execute.addButton")}
				</Button>
			</div>
			<div className="flex flex-wrap gap-2">
				{(allowedCommands ?? []).map((cmd, index) => (
					<Button
						key={index}
						variant="secondary"
						data-testid={`remove-command-${index}`}
						onClick={() => {
							const newCommands = (allowedCommands ?? []).filter((_, i) => i !== index)
							setCachedStateField("allowedCommands", newCommands)
							rootStore.settings.updateSettings({ allowedCommands: newCommands })
						}}>
						<div className="flex flex-row items-center gap-1">
							<div>{cmd}</div>
							<X className="text-foreground scale-75" />
						</div>
					</Button>
				))}
			</div>
			<SearchableSetting
				settingId="auto-approve-denied-commands"
				section="autoApprove"
				label={t("settings:autoApprove.execute.deniedCommands")}
				className="mt-6">
				<label className="block font-medium mb-1" data-testid="denied-commands-heading">
					{t("settings:autoApprove.execute.deniedCommands")}
				</label>
				<div className="text-vscode-descriptionForeground text-sm mt-1">
					{t("settings:autoApprove.execute.deniedCommandsDescription")}
				</div>
			</SearchableSetting>
			<div className="flex gap-2">
				<Input
					value={deniedCommandInput}
					onChange={(e) => setDeniedCommandInput((e.target as HTMLInputElement).value)}
					onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
						if (e.key === "Enter") {
							e.preventDefault()
							handleAddDeniedCommand()
						}
					}}
					placeholder={t("settings:autoApprove.execute.deniedCommandPlaceholder")}
					className="grow"
					data-testid="denied-command-input"
				/>
				<Button className="h-8" onClick={handleAddDeniedCommand} data-testid="add-denied-command-button">
					{t("settings:autoApprove.execute.addButton")}
				</Button>
			</div>
			<div className="flex flex-wrap gap-2">
				{(deniedCommands ?? []).map((cmd, index) => (
					<Button
						key={index}
						variant="secondary"
						data-testid={`remove-denied-command-${index}`}
						onClick={() => {
							const newCommands = (deniedCommands ?? []).filter((_, i) => i !== index)
							setCachedStateField("deniedCommands", newCommands)
							rootStore.settings.updateSettings({ deniedCommands: newCommands })
						}}>
						<div className="flex flex-row items-center gap-1">
							<div>{cmd}</div>
							<X className="text-foreground scale-75" />
						</div>
					</Button>
				))}
			</div>
		</div>
	)
}
