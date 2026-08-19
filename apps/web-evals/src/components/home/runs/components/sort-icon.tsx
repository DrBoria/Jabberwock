import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

import type { SortColumn, SortDirection } from "../state/types"

export function SortIcon({
	column,
	sortColumn,
	sortDirection,
}: {
	column: SortColumn
	sortColumn: SortColumn | null
	sortDirection: SortDirection
}) {
	if (sortColumn !== column) {
		return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
	}
	return sortDirection === "asc" ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
}
