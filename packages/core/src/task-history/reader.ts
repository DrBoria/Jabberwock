import * as fs from "fs/promises"
import * as path from "path"

import type { TaskSessionEntry } from "./types.ts"
import { extractSessionEntry, readJsonFile } from "./utils.ts"

const HISTORY_ITEM_FILENAME = "history_item.json"
const HISTORY_INDEX_FILENAME = "_index.json"

async function loadIndexEntries(tasksDir: string, sessionsById: Map<string, TaskSessionEntry>): Promise<void> {
	const historyIndex = await readJsonFile(path.join(tasksDir, HISTORY_INDEX_FILENAME))
	const indexEntries = isRecord(historyIndex) && Array.isArray(historyIndex.entries) ? historyIndex.entries : []

	for (const entry of indexEntries) {
		const session = extractSessionEntry(entry)
		if (session) {
			sessionsById.set(session.id, session)
		}
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null
}

function removeStaleEntries(taskDirs: string[], sessionsById: Map<string, TaskSessionEntry>): void {
	if (taskDirs.length > 0) {
		const onDiskIds = new Set(taskDirs)
		for (const sessionId of sessionsById.keys()) {
			if (!onDiskIds.has(sessionId)) {
				sessionsById.delete(sessionId)
			}
		}
	}
}

export async function readTaskSessionsFromStoragePath(storageBasePath: string): Promise<TaskSessionEntry[]> {
	const tasksDir = path.join(storageBasePath, "tasks")
	const sessionsById = new Map<string, TaskSessionEntry>()

	await loadIndexEntries(tasksDir, sessionsById)

	let taskDirs: string[] = []

	try {
		const entries = await fs.readdir(tasksDir, { withFileTypes: true })
		taskDirs = entries
			.filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith("."))
			.map((entry) => entry.name)
	} catch {
		// No tasks directory; return index-derived entries only.
	}

	for (const taskId of taskDirs) {
		if (sessionsById.has(taskId)) {
			continue
		}

		const historyItem = await readJsonFile(path.join(tasksDir, taskId, HISTORY_ITEM_FILENAME))
		const session = extractSessionEntry(historyItem)

		if (session) {
			sessionsById.set(session.id, session)
		}
	}

	removeStaleEntries(taskDirs, sessionsById)

	return Array.from(sessionsById.values()).sort((a, b) => b.ts - a.ts)
}
