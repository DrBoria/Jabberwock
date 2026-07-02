import React, { useState, useCallback, useMemo } from "react"
import { getAllModes } from "@shared/modes"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { observer } from "mobx-react-lite"
import { Button } from "@src/shared/ui/buttons/button"
import { Checkbox } from "@src/shared/ui/inputs/checkbox"
import { Input } from "@src/shared/ui/inputs/input"
import { Textarea } from "@src/shared/ui/inputs/textarea"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@src/shared/ui/overlays/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/shared/ui/selects/select"
import { rootStore } from "@src/features/store"
import type { CreateSkillDialogProps } from "./types"
import { validateSkillName, validateDescription } from "./validation"

export const CreateSkillDialog: React.FC<CreateSkillDialogProps> = observer(
	({ open, onOpenChange, onSkillCreated, hasWorkspace }) => {
		const { t } = useAppTranslation()
		const customModes = rootStore.extensionState.customModes
		const [name, setName] = useState("")
		const [description, setDescription] = useState("")
		const [source, setSource] = useState<"global" | "project">(hasWorkspace ? "project" : "global")
		const [nameError, setNameError] = useState<string | null>(null)
		const [descriptionError, setDescriptionError] = useState<string | null>(null)
		const [selectedModes, setSelectedModes] = useState<string[]>([])
		const [isAnyMode, setIsAnyMode] = useState(true)
		const availableModes = useMemo(
			() => getAllModes(customModes).map((m) => ({ slug: m.slug, name: m.name })),
			[customModes],
		)

		const resetForm = useCallback(() => {
			setName("")
			setDescription("")
			setSource(hasWorkspace ? "project" : "global")
			setSelectedModes([])
			setIsAnyMode(true)
			setNameError(null)
			setDescriptionError(null)
		}, [hasWorkspace])

		const handleClose = useCallback(() => {
			resetForm()
			onOpenChange(false)
		}, [resetForm, onOpenChange])

		const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
			setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
			setNameError(null)
		}, [])

		const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
			setDescription(e.target.value)
			setDescriptionError(null)
		}, [])

		const handleAnyModeToggle = useCallback((checked: boolean) => {
			if (checked) {
				setIsAnyMode(true)
				setSelectedModes([])
			} else setIsAnyMode(false)
		}, [])

		const handleModeToggle = useCallback((modeSlug: string, checked: boolean) => {
			if (checked) {
				setIsAnyMode(false)
				setSelectedModes((prev) => [...prev, modeSlug])
			} else {
				setSelectedModes((prev) => {
					const newModes = prev.filter((m) => m !== modeSlug)
					if (newModes.length === 0) setIsAnyMode(true)
					return newModes
				})
			}
		}, [])

		const handleCreate = useCallback(() => {
			const nameValidationError = validateSkillName(name)
			const descValidationError = validateDescription(description)
			if (nameValidationError) {
				setNameError(nameValidationError)
				return
			}
			if (descValidationError) {
				setDescriptionError(descValidationError)
				return
			}
			const modeSlugs = isAnyMode ? undefined : selectedModes.length > 0 ? selectedModes : undefined
			rootStore.marketplace.createSkill(name, description, modeSlugs)
			handleClose()
			onSkillCreated()
		}, [name, description, isAnyMode, selectedModes, handleClose, onSkillCreated])

		return (
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>{t("settings:skills.createDialog.title")}</DialogTitle>
						<DialogDescription></DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						<div className="flex flex-col gap-1">
							<label htmlFor="skill-name" className="text-sm font-medium text-vscode-foreground">
								{t("settings:skills.createDialog.nameLabel")}
							</label>
							<Input
								id="skill-name"
								type="text"
								value={name}
								onChange={handleNameChange}
								placeholder={t("settings:skills.createDialog.namePlaceholder")}
								maxLength={64}
								className="w-full bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded-xl px-3 py-2 focus:outline-none focus:border-vscode-focusBorder"
							/>
							{nameError && <span className="text-xs text-vscode-errorForeground">{t(nameError)}</span>}
						</div>
						<div className="flex flex-col gap-1">
							<Textarea
								id="skill-description"
								value={description}
								onChange={handleDescriptionChange}
								placeholder={t("settings:skills.createDialog.descriptionPlaceholder")}
								maxLength={1024}
								rows={5}
							/>
							{descriptionError && (
								<span className="text-xs text-vscode-errorForeground">{t(descriptionError)}</span>
							)}
						</div>
						<div className="flex flex-col gap-1">
							<label className="text-sm font-medium text-vscode-foreground">
								{t("settings:skills.createDialog.sourceLabel")}
							</label>
							<Select value={source} onValueChange={(value) => setSource(value as "global" | "project")}>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="global">{t("settings:skills.source.global")}</SelectItem>
									{hasWorkspace && (
										<SelectItem value="project">{t("settings:skills.source.project")}</SelectItem>
									)}
								</SelectContent>
							</Select>
						</div>
						<div className="flex flex-col gap-1">
							<label className="text-sm font-medium text-vscode-foreground">
								{t("settings:skills.createDialog.modeLabel")}
							</label>
							<span className="text-xs text-vscode-descriptionForeground mb-1">
								{t("settings:skills.modeDialog.intro")}
							</span>
							<div className="flex flex-col max-h-28 overflow-y-auto">
								<div className="flex items-center gap-3 p-1 rounded-lg hover:bg-vscode-list-hoverBackground">
									<Checkbox
										id="create-mode-any"
										checked={isAnyMode}
										onCheckedChange={(checked) => handleAnyModeToggle(checked === true)}
									/>
									<label htmlFor="create-mode-any" className="flex-1 cursor-pointer font-medium">
										{t("settings:skills.modeDialog.anyMode")}
									</label>
								</div>
								{availableModes.map((m) => (
									<div
										key={m.slug}
										className="flex items-center gap-3 p-1 rounded-lg hover:bg-vscode-list-hoverBackground">
										<Checkbox
											id={`create-mode-${m.slug}`}
											checked={selectedModes.includes(m.slug)}
											onCheckedChange={(checked) => handleModeToggle(m.slug, checked === true)}
										/>
										<label htmlFor={`create-mode-${m.slug}`} className="flex-1 cursor-pointer">
											{m.name}
										</label>
									</div>
								))}
							</div>
						</div>
					</div>
					<DialogFooter>
						<Button variant="secondary" onClick={handleClose}>
							{t("settings:skills.createDialog.cancel")}
						</Button>
						<Button variant="primary" onClick={handleCreate} disabled={!name || !description}>
							{t("settings:skills.createDialog.create")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		)
	},
)
