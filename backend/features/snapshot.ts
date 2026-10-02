import { readFileSync } from "fs"
import * as path from "path"

import { IntentStatus } from "@jabberwock/types"
import { isRecord } from "@utils/object"
import { sanitizeHistoryItem } from "@features/hist"

const SNAPSHOT_FILE = ".backend-snapshot.json"

function snapshotFilePath(globalStoragePath: string): string {
	return path.join(globalStoragePath, SNAPSHOT_FILE)
}

function createDefaultSnapshot(): Record<string, unknown> {
	return {
		settings: {
			apiConfig: {
				id: "",
				currentConfigName: "",
				listApiConfigMeta: [],
				apiProvider: "",
				apiModelId: "",
				baseUrl: "",
				includeMaxTokens: false,
				todoListEnabled: false,
				modelTemperature: 0,
				rateLimitSeconds: 0,
				consecutiveMistakeLimit: 0,
				enableReasoningEffort: false,
				reasoningEffort: "",
				modelMaxTokens: 0,
				modelMaxThinkingTokens: 0,
				verbosity: 0,
				apiKey: "",
				providerSpecificFields: {},
			},

			commands: {},
			debug: {},
			files: {},
			mcp: {},
			models: {},
			modes: {},
			prompts: {},
			skills: { skills: [] },
			vscode: {},
			webview: {},
			worktree: {},
			settingsImportedAt: 0,
		},
		cloud: {},
		marketplace: {},
		history: {
			items: [],
			currentTaskId: "",
		},
		eventLog: [],
	}
}

function deepMergeDefaults(
	defaults: Record<string, unknown>,
	overrides: Record<string, unknown>,
): Record<string, unknown> {
	const result: Record<string, unknown> = { ...overrides }
	for (const key of Object.keys(defaults)) {
		if (
			!Object.prototype.hasOwnProperty.call(overrides, key) ||
			overrides[key] === undefined ||
			overrides[key] === null
		) {
			result[key] = defaults[key]
		} else {
			const dVal = defaults[key]
			const oVal = overrides[key]
			if (isRecord(dVal) && isRecord(oVal)) {
				result[key] = deepMergeDefaults(dVal, oVal)
			}
		}
	}
	return result
}

function sanitizeHistorySnapshot(snapshot: Record<string, unknown>): void {
	const historySnap: unknown = snapshot.history
	if (!isRecord(historySnap) || !Array.isArray(historySnap.items)) {
		return
	}
	const items: unknown[] = historySnap.items
	snapshot.history = {
		...historySnap,
		currentTaskId: typeof historySnap.currentTaskId === "string" ? historySnap.currentTaskId : "",
		items: items.map((raw: unknown) => sanitizeHistoryItem(raw)),
	}
}

function sanitizeChatSnapshot(snapshot: Record<string, unknown>): void {
	const chatSnap = isRecord(snapshot.chat) ? snapshot.chat : null
	if (!chatSnap || !isRecord(chatSnap.tasks)) {
		return
	}
	const sanitizedTasks: Record<string, unknown> = {}
	for (const [taskId, taskData] of Object.entries(chatSnap.tasks)) {
		if (!isRecord(taskData)) {
			sanitizedTasks[taskId] = taskData
			continue
		}
		const { messages: _messages, ...cleanTask } = taskData
		sanitizedTasks[taskId] = cleanTask
	}
	chatSnap.tasks = sanitizedTasks
}
/**
 * Purge non-terminal intents from "a" restored snapshot.
 *
 * The IntentBus re-dispatches every Queued/Processing intent it finds after
 * startup, so a crash-recovery snapshot replays the previous session's dead
 * work (broadcasts, user-message intents for long-gone tasks, ask intents
 * whose promise can never resolve). Only terminal intents (Success/Failed)
 * are kept — they are inert history.
 */
function sanitizeIntentStoreSnapshot(snapshot: Record<string, unknown>): void {
	const intentStoreSnap: unknown = snapshot.intentStore
	if (!isRecord(intentStoreSnap)) {
		return
	}
	const intents = intentStoreSnap.intents
	if (!Array.isArray(intents)) {
		return
	}
	const nonTerminal = new Set<string>([IntentStatus.Queued, IntentStatus.Processing, IntentStatus.Suspended])
	intentStoreSnap.intents = (intents as Array<{ status?: unknown }>).filter(
		(intent) => typeof intent.status !== "string" || !nonTerminal.has(intent.status),
	)
}
export function loadSnapshot(globalStoragePath: string | undefined): Record<string, unknown> {
	const defaultSnapshot = createDefaultSnapshot()
	if (!globalStoragePath) {
		return defaultSnapshot
	}
	try {
		const content = readFileSync(snapshotFilePath(globalStoragePath), "utf-8")
		const rawSnapshot: unknown = JSON.parse(content)
		return isRecord(rawSnapshot) ? deepMergeDefaults(defaultSnapshot, rawSnapshot) : defaultSnapshot
	} catch {
		return defaultSnapshot
	}
}

export function sanitizeSnapshots(snapshot: Record<string, unknown>): void {
	sanitizeHistorySnapshot(snapshot)
	sanitizeChatSnapshot(snapshot)
	sanitizeIntentStoreSnapshot(snapshot)
}
