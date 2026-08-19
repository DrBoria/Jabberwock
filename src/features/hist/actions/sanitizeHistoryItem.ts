function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value)
}

export interface HistoryTaskProps {
	id: string
	task: string
	ts: number
	tokensIn: number
	tokensOut: number
	cacheWrites: number
	cacheReads: number
	totalCost: number
	workspace: string | undefined
	mode: string | undefined
	status: string | undefined
	parentTaskId: string | undefined
	rootTaskId: string | undefined
	childIds: string[]
	number: number | undefined
	size: number | undefined
	apiConfigName: string | undefined
}

function asRecord(value: unknown): Record<string, unknown> {
	return isRecord(value) ? value : Object.create(null)
}

function strField(item: Record<string, unknown>, key: string, fallback: string): string {
	return typeof item[key] === "string" ? (item[key] as string) : fallback
}

function numField(item: Record<string, unknown>, key: string, fallback: number): number {
	return typeof item[key] === "number" ? (item[key] as number) : fallback
}

function optStrField(item: Record<string, unknown>, key: string): string | undefined {
	return typeof item[key] === "string" ? (item[key] as string) : undefined
}

function optNumField(item: Record<string, unknown>, key: string): number | undefined {
	return typeof item[key] === "number" ? (item[key] as number) : undefined
}

function strArrField(item: Record<string, unknown>, key: string): string[] {
	const raw = item[key]
	return Array.isArray(raw) ? raw.filter((c: unknown): c is string => typeof c === "string") : []
}

export function sanitizeHistoryItem(raw: unknown): HistoryTaskProps {
	const item = asRecord(raw)
	return {
		id: strField(item, "id", crypto.randomUUID()),
		task: strField(item, "task", ""),
		ts: numField(item, "ts", Date.now()),
		tokensIn: numField(item, "tokensIn", 0),
		tokensOut: numField(item, "tokensOut", 0),
		cacheWrites: numField(item, "cacheWrites", 0),
		cacheReads: numField(item, "cacheReads", 0),
		totalCost: numField(item, "totalCost", 0),
		workspace: optStrField(item, "workspace"),
		mode: optStrField(item, "mode"),
		status: optStrField(item, "status"),
		parentTaskId: optStrField(item, "parentTaskId"),
		rootTaskId: optStrField(item, "rootTaskId"),
		childIds: strArrField(item, "childIds"),
		number: optNumField(item, "number"),
		size: optNumField(item, "size"),
		apiConfigName: optStrField(item, "apiConfigName"),
	}
}
