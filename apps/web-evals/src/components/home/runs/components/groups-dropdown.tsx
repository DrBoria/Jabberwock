"use client"

import { Layers, Pencil, Plus, Trash2 } from "lucide-react"

import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui"

import { getIconByName } from "../state/helpers"
import type { ToolGroup } from "../state/types"

export function GroupsDropdown({
	groups,
	onEdit,
	onDelete,
	onNew,
}: {
	groups: ToolGroup[]
	onEdit: (group: ToolGroup) => void
	onDelete: (groupId: string) => void
	onNew: () => void
}) {
	return (
		<div className="flex items-center gap-2">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" size="sm" className="flex items-center gap-2">
						<Layers className="h-4 w-4" />
						<span>Groups</span>
						{groups.length > 0 && (
							<span className="bg-primary text-primary-foreground text-xs px-1.5 rounded-full">
								{groups.length}
							</span>
						)}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-64">
					{groups.length > 0 ? (
						<>
							{groups.map((group) => {
								const IconComponent = getIconByName(group.icon)
								return (
									<DropdownMenuItem
										key={group.id}
										className="flex items-center justify-between"
										onClick={(e) => {
											e.preventDefault()
											onEdit(group)
										}}>
										<div className="flex items-center gap-2">
											<IconComponent className="h-4 w-4" />
											<span>{group.name}</span>
											<span className="text-xs text-muted-foreground">
												({group.tools.length})
											</span>
										</div>
										<div className="flex items-center gap-1">
											<Button
												variant="ghost"
												size="icon"
												className="h-6 w-6"
												onClick={(e) => {
													e.stopPropagation()
													onEdit(group)
												}}>
												<Pencil className="h-3 w-3" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="h-6 w-6 text-destructive hover:text-destructive"
												onClick={(e) => {
													e.stopPropagation()
													onDelete(group.id)
												}}>
												<Trash2 className="h-3 w-3" />
											</Button>
										</div>
									</DropdownMenuItem>
								)
							})}
							<DropdownMenuSeparator />
						</>
					) : (
						<div className="px-2 py-1.5 text-sm text-muted-foreground">No groups yet</div>
					)}
					<DropdownMenuItem onClick={onNew}>
						<Plus className="h-4 w-4 mr-2" />
						Add Group
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	)
}
