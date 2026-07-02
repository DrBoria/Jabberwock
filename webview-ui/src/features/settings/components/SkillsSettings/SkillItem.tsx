import { Edit, Settings, Trash2 } from "lucide-react"
import type { SkillMetadata } from "@jabberwock/types"
import { Button } from "@src/shared/ui/buttons/button"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"

interface SkillItemProps {
	skill: SkillMetadata
	onEdit: (skill: SkillMetadata) => void
	onDelete: (skill: SkillMetadata) => void
	onOpenModeDialog: (skill: SkillMetadata) => void
	t: (key: string) => string
}

export const SkillItem = ({ skill, onEdit, onDelete, onOpenModeDialog, t }: SkillItemProps) => (
	<div
		key={`${skill.source}-${skill.name}-${skill.modeSlugs?.join(",") || "any"}`}
		className="p-2.5 px-2 rounded-xl border border-transparent">
		<div className="flex items-start justify-between gap-2 flex-col min-[400px]:flex-row overflow-hidden">
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2 overflow-hidden">
					<span className="font-medium truncate">{skill.name}</span>
				</div>
				{skill.description && (
					<div className="text-xs text-vscode-descriptionForeground mt-1 line-clamp-3">
						{skill.description}
					</div>
				)}
			</div>
			<div className="flex items-center gap-1 px-0 ml-0 min-[400px]:ml-0 min-[400px]:mt-4 flex-shrink-0">
				<StandardTooltip content={t("settings:skills.configureModes")}>
					<Button variant="ghost" size="icon" onClick={() => onOpenModeDialog(skill)}>
						<Settings className="size-4" />
					</Button>
				</StandardTooltip>
				<StandardTooltip content={t("settings:skills.editSkill")}>
					<Button variant="ghost" size="icon" onClick={() => onEdit(skill)}>
						<Edit />
					</Button>
				</StandardTooltip>
				<StandardTooltip content={t("settings:skills.deleteSkill")}>
					<Button variant="ghost" size="icon" onClick={() => onDelete(skill)}>
						<Trash2 className="text-destructive" />
					</Button>
				</StandardTooltip>
			</div>
		</div>
	</div>
)
