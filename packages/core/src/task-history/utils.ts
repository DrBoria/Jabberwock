import * as fs from "fs/promises"

import type { TaskSessionEntry } from "./types.ts"

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null
}

export function extractSessionEntry(value: unknown): TaskSessionEntry | undefined {
	if (!isRecord(value)) {
		return undefined
	}

	const id = value.id
	const task = value.task
	const ts = value.ts
	const workspace = value.workspace
	const mode = value.mode
	const status = value.status

	if (typeof id !== "string" || typeof task !== "string" || typeof ts !== "number") {
		return undefined
	}

	return {
		id,
		task,
		ts,
		workspace: typeof workspace === "string" ? workspace : undefined,
		mode: typeof mode === "string" ? mode : undefined,
		status: status === "active" || status === "completed" || status === "delegated" ? status : undefined,
	}
}

export async function readJsonFile(filePath: string): Promise<unknown | undefined> {
	try {
		const raw = await fs.readFile(filePath, "utf8")
		return JSON.parse(raw)
	} catch {
		return undefined
	}
}
