"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui"
import { TableHead, TableHeader, TableRow } from "@/components/ui"

import { getIconByName, getToolAbbreviation } from "../state/helpers"
import { SortIcon } from "./sort-icon"
import type { ToolGroup, SortColumn, SortDirection } from "../state/types"

type RunsTableHeaderProps = {
	sortColumn: SortColumn | null
	sortDirection: SortDirection
	onSort: (column: SortColumn) => void
	toolGroups: ToolGroup[]
	toolColumns: string[]
}

export function RunsTableHeader({ sortColumn, sortDirection, onSort, toolGroups, toolColumns }: RunsTableHeaderProps) {
	return (
		<TableHeader>
			<TableRow>
				<TableHead className="max-w-[200px] cursor-pointer select-none" onClick={() => onSort("model")}>
					<div className="flex items-center">
						Model
						<SortIcon column="model" sortColumn={sortColumn} sortDirection={sortDirection} />
					</div>
				</TableHead>
				<TableHead className="cursor-pointer select-none" onClick={() => onSort("provider")}>
					<div className="flex items-center">
						Provider
						<SortIcon column="provider" sortColumn={sortColumn} sortDirection={sortDirection} />
					</div>
				</TableHead>
				<TableHead className="cursor-pointer select-none" onClick={() => onSort("createdAt")}>
					<div className="flex items-center">
						Created
						<SortIcon column="createdAt" sortColumn={sortColumn} sortDirection={sortDirection} />
					</div>
				</TableHead>
				<TableHead className="cursor-pointer select-none" onClick={() => onSort("passed")}>
					<div className="flex items-center">
						Passed
						<SortIcon column="passed" sortColumn={sortColumn} sortDirection={sortDirection} />
					</div>
				</TableHead>
				<TableHead className="cursor-pointer select-none" onClick={() => onSort("failed")}>
					<div className="flex items-center">
						Failed
						<SortIcon column="failed" sortColumn={sortColumn} sortDirection={sortDirection} />
					</div>
				</TableHead>
				<TableHead className="cursor-pointer select-none" onClick={() => onSort("percent")}>
					<div className="flex items-center">
						%
						<SortIcon column="percent" sortColumn={sortColumn} sortDirection={sortDirection} />
					</div>
				</TableHead>
				<TableHead>Tokens</TableHead>
				{toolGroups.map((group) => {
					const IconComponent = getIconByName(group.icon)
					return (
						<TableHead key={group.id} className="text-center">
							<div className="flex justify-center">
								<Tooltip>
									<TooltipTrigger>
										<IconComponent className="h-4 w-4" />
									</TooltipTrigger>
									<TooltipContent>
										<div className="text-xs">
											<div className="font-semibold mb-1">{group.name}</div>
											{group.tools.map((tool) => (
												<div key={tool}>{tool}</div>
											))}
										</div>
									</TooltipContent>
								</Tooltip>
							</div>
						</TableHead>
					)
				})}
				{toolColumns.map((toolName) => (
					<TableHead key={toolName} className="text-xs text-center">
						<Tooltip>
							<TooltipTrigger>{getToolAbbreviation(toolName)}</TooltipTrigger>
							<TooltipContent>{toolName}</TooltipContent>
						</Tooltip>
					</TableHead>
				))}
				<TableHead className="cursor-pointer select-none" onClick={() => onSort("cost")}>
					<div className="flex items-center">
						Cost
						<SortIcon column="cost" sortColumn={sortColumn} sortDirection={sortDirection} />
					</div>
				</TableHead>
				<TableHead className="cursor-pointer select-none" onClick={() => onSort("duration")}>
					<div className="flex items-center">
						Duration
						<SortIcon column="duration" sortColumn={sortColumn} sortDirection={sortDirection} />
					</div>
				</TableHead>
				<TableHead></TableHead>
			</TableRow>
		</TableHeader>
	)
}
