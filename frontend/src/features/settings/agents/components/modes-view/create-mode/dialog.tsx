import React from "react"
import { VSCodeTextArea, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import type { GroupEntry, ToolGroup, ModeSource } from "../types"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/shared/ui/buttons/button"
import { Input } from "@src/shared/ui/inputs/input"
import { SaveLocationSection } from "./SaveLocationSection"
import { RoleDefinitionSection } from "./RoleDefinitionSection"
import { ToolsSection } from "./ToolsSection"

type CreateModeDialogProps = {
	open: boolean
	onClose: () => void
	newModeName: string
	newModeSlug: string
	newModeDescription: string
	newModeRoleDefinition: string
	newModeWhenToUse: string
	newModeCustomInstructions: string
	newModeGroups: GroupEntry[]
	newModeSource: ModeSource
	nameError: string
	slugError: string
	descriptionError: string
	roleDefinitionError: string
	groupsError: string
	onNameChange: (name: string) => void
	onSlugChange: (slug: string) => void
	onDescriptionChange: (value: string) => void
	onRoleDefinitionChange: (value: string) => void
	onWhenToUseChange: (value: string) => void
	onCustomInstructionsChange: (value: string) => void
	onSourceChange: (source: ModeSource) => void
	onGroupToggle: (group: ToolGroup, checked: boolean) => void
	onCreate: () => void
}

export const CreateModeDialog: React.FC<CreateModeDialogProps> = ({
	open,
	onClose,
	newModeName,
	newModeSlug,
	newModeDescription,
	newModeRoleDefinition,
	newModeWhenToUse,
	newModeCustomInstructions,
	newModeGroups,
	newModeSource,
	nameError,
	slugError,
	descriptionError,
	roleDefinitionError,
	groupsError,
	onNameChange,
	onSlugChange,
	onDescriptionChange,
	onRoleDefinitionChange,
	onWhenToUseChange,
	onCustomInstructionsChange,
	onSourceChange,
	onGroupToggle,
	onCreate,
}) => {
	const { t } = useAppTranslation()

	if (!open) return null

	return (
		<div className="fixed inset-0 flex justify-end bg-black/50 z-[1000]">
			<div className="w-[calc(100vw-100px)] h-full bg-vscode-editor-background shadow-md flex flex-col relative">
				<div className="flex-1 p-5 overflow-y-auto min-h-0">
					<Button variant="ghost" size="icon" onClick={onClose} className="absolute top-5 right-5">
						<span className="codicon codicon-close" />
					</Button>
					<h2 className="mb-4">{t("prompts:createModeDialog.title")}</h2>
					<div className="mb-4">
						<div className="font-bold mb-1">{t("prompts:createModeDialog.name.label")}</div>
						<Input
							type="text"
							value={newModeName}
							onChange={(e) => onNameChange(e.target.value)}
							className="w-full"
						/>
						{nameError && <div className="text-xs text-vscode-errorForeground mt-1">{nameError}</div>}
					</div>
					<div className="mb-4">
						<div className="font-bold mb-1">{t("prompts:createModeDialog.slug.label")}</div>
						<Input
							type="text"
							value={newModeSlug}
							onChange={(e) => onSlugChange(e.target.value)}
							className="w-full"
						/>
						<div className="text-xs text-vscode-descriptionForeground mt-1">
							{t("prompts:createModeDialog.slug.description")}
						</div>
						{slugError && <div className="text-xs text-vscode-errorForeground mt-1">{slugError}</div>}
					</div>
					<SaveLocationSection newModeSource={newModeSource} onSourceChange={onSourceChange} />
					<RoleDefinitionSection
						value={newModeRoleDefinition}
						error={roleDefinitionError}
						onChange={onRoleDefinitionChange}
					/>
					<div className="mb-4">
						<div className="font-bold mb-1">{t("prompts:createModeDialog.description.label")}</div>
						<div className="text-[13px] text-vscode-descriptionForeground mb-2">
							{t("prompts:createModeDialog.description.description")}
						</div>
						<VSCodeTextField
							value={newModeDescription}
							onChange={(e) => onDescriptionChange((e.target as HTMLInputElement).value)}
							className="w-full"
						/>
						{descriptionError && (
							<div className="text-xs text-vscode-errorForeground mt-1">{descriptionError}</div>
						)}
					</div>
					<div className="mb-4">
						<div className="font-bold mb-1">{t("prompts:createModeDialog.whenToUse.label")}</div>
						<div className="text-[13px] text-vscode-descriptionForeground mb-2">
							{t("prompts:createModeDialog.whenToUse.description")}
						</div>
						<VSCodeTextArea
							resize="vertical"
							value={newModeWhenToUse}
							onChange={(e) => onWhenToUseChange((e.target as HTMLTextAreaElement).value)}
							rows={3}
							className="w-full"
						/>
					</div>
					<ToolsSection
						newModeGroups={newModeGroups}
						groupsError={groupsError}
						onGroupToggle={onGroupToggle}
					/>
					<div className="mb-4">
						<div className="font-bold mb-1">{t("prompts:createModeDialog.customInstructions.label")}</div>
						<div className="text-[13px] text-vscode-descriptionForeground mb-2">
							{t("prompts:createModeDialog.customInstructions.description")}
						</div>
						<VSCodeTextArea
							resize="vertical"
							value={newModeCustomInstructions}
							onChange={(e) => onCustomInstructionsChange((e.target as HTMLTextAreaElement).value)}
							rows={4}
							className="w-full"
						/>
					</div>
				</div>
				<div className="flex justify-end p-3 px-5 gap-2 border-t border-vscode-editor-lineHighlightBorder bg-vscode-editor-background">
					<Button variant="secondary" onClick={onClose}>
						{t("prompts:createModeDialog.buttons.cancel")}
					</Button>
					<Button variant="primary" onClick={onCreate}>
						{t("prompts:createModeDialog.buttons.create")}
					</Button>
				</div>
			</div>
		</div>
	)
}
