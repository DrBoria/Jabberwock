"use client"

import { Ellipsis, Trash2 } from "lucide-react"

import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	MultiSelect,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui"

import { TIMEFRAME_OPTIONS } from "../state/constants"
import type { TimeframeOption } from "../state/types"
import { GroupsDropdown } from "./groups-dropdown"

export { GroupsDropdown }

export function TimeframeSelect({
	value,
	onChange,
}: {
	value: TimeframeOption
	onChange: (value: TimeframeOption) => void
}) {
	return (
		<div className="flex items-center gap-2">
			<span className="text-sm font-medium text-muted-foreground">Timeframe:</span>
			<Select value={value} onValueChange={(v) => onChange(v as TimeframeOption)}>
				<SelectTrigger className="w-[140px]">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{TIMEFRAME_OPTIONS.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	)
}

export function ModelMultiSelect({
	value,
	options,
	onChange,
}: {
	value: string[]
	options: { label: string; value: string }[]
	onChange: (value: string[]) => void
}) {
	return (
		<div className="flex items-center gap-2">
			<span className="text-sm font-medium text-muted-foreground">Model:</span>
			<MultiSelect
				options={options}
				value={value}
				onValueChange={onChange}
				placeholder="All models"
				className="w-[200px]"
				maxCount={1}
			/>
		</div>
	)
}

export function ProviderMultiSelect({
	value,
	options,
	onChange,
}: {
	value: string[]
	options: { label: string; value: string }[]
	onChange: (value: string[]) => void
}) {
	return (
		<div className="flex items-center gap-2">
			<span className="text-sm font-medium text-muted-foreground">Provider:</span>
			<MultiSelect
				options={options}
				value={value}
				onValueChange={onChange}
				placeholder="All providers"
				className="w-[180px]"
				maxCount={1}
			/>
		</div>
	)
}

export function BulkActionsDropdown({
	incompleteRunsCount,
	oldRunsCount,
	isDeleting,
	onDeleteIncomplete,
	onDeleteOld,
}: {
	incompleteRunsCount: number
	oldRunsCount: number
	isDeleting: boolean
	onDeleteIncomplete: () => void
	onDeleteOld: () => void
}) {
	return (
		<DropdownMenu>
			<Button variant="ghost" size="sm" asChild>
				<DropdownMenuTrigger disabled={isDeleting}>
					<Ellipsis className="h-4 w-4" />
				</DropdownMenuTrigger>
			</Button>
			<DropdownMenuContent align="end">
				{incompleteRunsCount > 0 && (
					<DropdownMenuItem
						onClick={onDeleteIncomplete}
						disabled={isDeleting}
						className="text-destructive focus:text-destructive">
						<Trash2 className="h-4 w-4 mr-2" />
						Delete {incompleteRunsCount} incomplete run{incompleteRunsCount !== 1 ? "s" : ""}
					</DropdownMenuItem>
				)}
				{oldRunsCount > 0 && (
					<DropdownMenuItem
						onClick={onDeleteOld}
						disabled={isDeleting}
						className="text-destructive focus:text-destructive">
						<Trash2 className="h-4 w-4 mr-2" />
						Delete {oldRunsCount} run{oldRunsCount !== 1 ? "s" : ""} over 30d
					</DropdownMenuItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
