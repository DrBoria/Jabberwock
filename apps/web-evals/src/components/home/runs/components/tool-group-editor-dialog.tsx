"use client"

import { useEffect, useState, memo, useCallback } from "react"

import {
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	MultiSelect,
} from "@/components/ui"

import { TOOL_GROUP_ICONS } from "../state/constants"
import { generateGroupId } from "../state/helpers"
import type { ToolGroup } from "../state/types"

function getInitialValue<T>(value: T | null | undefined, fallback: T): T {
	return value ?? fallback
}

function useEditorForm(open: boolean, editingGroup: ToolGroup | null) {
	const [groupName, setGroupName] = useState(getInitialValue(editingGroup?.name, ""))
	const [groupIcon, setGroupIcon] = useState(getInitialValue(editingGroup?.icon, "combine"))
	const [groupTools, setGroupTools] = useState<string[]>(getInitialValue(editingGroup?.tools, []))

	useEffect(() => {
		if (!open) return
		setGroupName(getInitialValue(editingGroup?.name, ""))
		setGroupIcon(getInitialValue(editingGroup?.icon, "combine"))
		setGroupTools(getInitialValue(editingGroup?.tools, []))
	}, [open, editingGroup])

	return { groupName, setGroupName, groupIcon, setGroupIcon, groupTools, setGroupTools }
}

export const ToolGroupEditorDialog = memo(function ToolGroupEditorDialog({
	open,
	onOpenChange,
	editingGroup,
	availableTools,
	onSave,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	editingGroup: ToolGroup | null
	availableTools: { label: string; value: string }[]
	onSave: (group: ToolGroup) => void
}) {
	const { groupName, setGroupName, groupIcon, setGroupIcon, groupTools, setGroupTools } = useEditorForm(
		open,
		editingGroup,
	)

	const hasName = groupName.trim().length > 0
	const hasTools = groupTools.length > 0
	const canSaveGroup = hasName && hasTools
	const isEditing = editingGroup !== null

	const handleSave = useCallback(() => {
		if (!canSaveGroup) return
		const group: ToolGroup = {
			id: getInitialValue(editingGroup?.id, generateGroupId()),
			name: groupName.trim(),
			icon: groupIcon,
			tools: groupTools,
		}
		onSave(group)
		onOpenChange(false)
	}, [canSaveGroup, editingGroup, groupName, groupIcon, groupTools, onSave, onOpenChange])

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>{isEditing ? "Edit Tool Group" : "Create Tool Group"}</DialogTitle>
				</DialogHeader>
				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<label className="text-sm font-medium">
							Group Name <span className="text-destructive">*</span>
						</label>
						<Input
							placeholder="e.g., File Operations"
							value={groupName}
							onChange={(e) => setGroupName(e.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<label className="text-sm font-medium">Icon</label>
						<div className="flex flex-wrap gap-2">
							{TOOL_GROUP_ICONS.map(({ name, icon: IconComponent }) => {
								const selected = groupIcon === name
								return (
									<Button
										key={name}
										variant={selected ? "default" : "outline"}
										size="icon"
										className="h-8 w-8"
										onClick={() => setGroupIcon(name)}>
										<IconComponent className="h-4 w-4" />
									</Button>
								)
							})}
						</div>
					</div>
					<div className="space-y-2">
						<label className="text-sm font-medium">
							Tools <span className="text-destructive">*</span>
						</label>
						<MultiSelect
							options={availableTools}
							value={groupTools}
							onValueChange={setGroupTools}
							placeholder="Select tools..."
							className="w-full"
							maxCount={3}
							modalPopover
						/>
						<div className="text-xs text-muted-foreground">
							{hasTools
								? `${groupTools.length} tool${groupTools.length !== 1 ? "s" : ""} selected`
								: "Select at least one tool"}
						</div>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={!canSaveGroup}>
						{isEditing ? "Save Changes" : "Create Group"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
})
