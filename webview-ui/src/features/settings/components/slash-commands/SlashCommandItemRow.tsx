import React from "react"
import { Edit, Trash2 } from "lucide-react"

import type { Command } from "@jabberwock/types"

import { Button } from "@src/shared/ui/buttons/button"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"

interface SlashCommandItemRowProps {
	command: Command
	t: (key: string, options?: Record<string, unknown>) => string
	onEdit: (command: Command) => void
	onDelete: (command: Command) => void
}

export const SlashCommandItemRow: React.FC<SlashCommandItemRowProps> = ({ command, t, onEdit, onDelete }) => {
	const isBuiltIn = command.source === "built-in"

	return (
		<div key={`${command.source}-${command.name}`} className="p-2.5 px-2 rounded-xl border border-transparent">
			<div className="flex items-start justify-between gap-2 flex-col min-[400px]:flex-row overflow-hidden">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 overflow-hidden">
						<span className="font-medium truncate">{command.name}</span>
					</div>
					{command.description && (
						<div className="text-xs text-vscode-descriptionForeground mt-1 line-clamp-3">
							{command.description}
						</div>
					)}
				</div>
				<div className="flex items-center gap-1 px-0 ml-0 min-[400px]:ml-0 min-[400px]:mt-2 flex-shrink-0">
					<StandardTooltip content={t("settings:slashCommands.editCommand")}>
						<Button data-testid="button" variant="ghost" size="icon" onClick={() => onEdit(command)}>
							<Edit />
						</Button>
					</StandardTooltip>
					{!isBuiltIn && (
						<StandardTooltip content={t("settings:slashCommands.deleteCommand")}>
							<Button data-testid="button" variant="ghost" size="icon" onClick={() => onDelete(command)}>
								<Trash2 className="text-destructive" />
							</Button>
						</StandardTooltip>
					)}
				</div>
			</div>
		</div>
	)
}
