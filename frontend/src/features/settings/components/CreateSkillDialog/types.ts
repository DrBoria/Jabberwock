export interface CreateSkillDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onSkillCreated: () => void
	hasWorkspace: boolean
}
