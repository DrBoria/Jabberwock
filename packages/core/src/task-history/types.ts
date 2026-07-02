import type { HistoryItem } from "@jabberwock/types"

export interface TaskSessionEntry {
	id: string
	task: string
	ts: number
	workspace?: string
	mode?: string
	status?: HistoryItem["status"]
}
