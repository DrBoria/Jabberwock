"use client"

import { X } from "lucide-react"

import { Button } from "@/components/ui"

import {
	TimeframeSelect,
	ModelMultiSelect,
	ProviderMultiSelect,
	GroupsDropdown,
	BulkActionsDropdown,
} from "./filter-bar-components"
import type { ToolGroup, TimeframeOption } from "../state/types"

type FilterBarProps = {
	timeframeFilter: TimeframeOption
	onTimeframeChange: (value: TimeframeOption) => void
	modelFilter: string[]
	modelOptions: { label: string; value: string }[]
	onModelFilterChange: (value: string[]) => void
	providerFilter: string[]
	providerOptions: { label: string; value: string }[]
	onProviderFilterChange: (value: string[]) => void
	toolGroups: ToolGroup[]
	onEditGroup: (group: ToolGroup) => void
	onDeleteGroup: (groupId: string) => void
	onNewGroup: () => void
	hasActiveFilters: boolean
	onClearFilters: () => void
	incompleteRunsCount: number
	oldRunsCount: number
	isDeleting: boolean
	onDeleteIncomplete: () => void
	onDeleteOld: () => void
	filteredRunsCount: number
	totalRunsCount: number
}

export function FilterBar(props: FilterBarProps) {
	return (
		<div className="flex items-center gap-4 p-4 border border-b-0 rounded-t-md bg-muted/30">
			<TimeframeSelect value={props.timeframeFilter} onChange={props.onTimeframeChange} />
			<ModelMultiSelect
				value={props.modelFilter}
				options={props.modelOptions}
				onChange={props.onModelFilterChange}
			/>
			<ProviderMultiSelect
				value={props.providerFilter}
				options={props.providerOptions}
				onChange={props.onProviderFilterChange}
			/>
			<GroupsDropdown
				groups={props.toolGroups}
				onEdit={props.onEditGroup}
				onDelete={props.onDeleteGroup}
				onNew={props.onNewGroup}
			/>
			{props.hasActiveFilters && (
				<Button variant="ghost" size="sm" onClick={props.onClearFilters}>
					<X className="h-4 w-4 mr-1" />
					Clear filters
				</Button>
			)}
			<div className="flex items-center gap-2 ml-auto">
				{(props.incompleteRunsCount > 0 || props.oldRunsCount > 0) && (
					<BulkActionsDropdown
						incompleteRunsCount={props.incompleteRunsCount}
						oldRunsCount={props.oldRunsCount}
						isDeleting={props.isDeleting}
						onDeleteIncomplete={props.onDeleteIncomplete}
						onDeleteOld={props.onDeleteOld}
					/>
				)}
				<div className="text-sm text-muted-foreground">
					{props.filteredRunsCount} of {props.totalRunsCount} runs
				</div>
			</div>
		</div>
	)
}
