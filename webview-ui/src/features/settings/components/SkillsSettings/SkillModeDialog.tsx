import { Checkbox } from "@src/shared/ui/inputs/checkbox"
import { Button } from "@src/shared/ui/buttons/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@src/shared/ui/overlays/dialog"

interface SkillModeDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	isAnyMode: boolean
	selectedModes: string[]
	availableModes: { slug: string; name: string }[]
	onAnyModeToggle: (checked: boolean) => void
	onModeToggle: (modeSlug: string, checked: boolean) => void
	onSave: () => void
	onClose: () => void
	t: (key: string) => string
}

export const SkillModeDialog = ({
	open,
	onOpenChange,
	isAnyMode,
	selectedModes,
	availableModes,
	onAnyModeToggle,
	onModeToggle,
	onSave,
	onClose,
	t,
}: SkillModeDialogProps) => (
	<Dialog open={open} onOpenChange={onOpenChange}>
		<DialogContent className="max-w-md">
			<DialogHeader>
				<DialogTitle>{t("settings:skills.modeDialog.title")}</DialogTitle>
				<DialogDescription />
			</DialogHeader>
			<div className="flex flex-col gap-1">
				<p className="text-vscode-descriptionForeground">{t("settings:skills.modeDialog.intro")}</p>
				<div className="flex items-center gap-3 px-1 rounded-lg hover:bg-vscode-list-hoverBackground">
					<Checkbox
						id="mode-any"
						checked={isAnyMode}
						onCheckedChange={(checked) => onAnyModeToggle(checked === true)}
					/>
					<label htmlFor="mode-any" className="flex-1 cursor-pointer font-medium">
						{t("settings:skills.modeDialog.anyMode")}
					</label>
				</div>
				<div className="h-px bg-vscode-widget-border" />
				<div className="flex flex-col max-h-60 overflow-y-auto">
					{availableModes.map((mode) => (
						<div
							key={mode.slug}
							className="flex items-center gap-3 p-1 rounded-lg hover:bg-vscode-list-hoverBackground">
							<Checkbox
								id={`mode-${mode.slug}`}
								checked={selectedModes.includes(mode.slug)}
								onCheckedChange={(checked) => onModeToggle(mode.slug, checked === true)}
							/>
							<label htmlFor={`mode-${mode.slug}`} className="flex-1 cursor-pointer">
								{mode.name}
							</label>
						</div>
					))}
				</div>
			</div>
			<DialogFooter>
				<Button variant="secondary" onClick={onClose}>
					{t("settings:skills.modeDialog.cancel")}
				</Button>
				<Button onClick={onSave}>{t("settings:skills.modeDialog.save")}</Button>
			</DialogFooter>
		</DialogContent>
	</Dialog>
)
