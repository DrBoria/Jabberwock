import { readFileSync } from "fs"
import * as path from "path"

import { sanitizeHistoryItem } from "@features/hist/actions/sanitizeHistoryItem"

const SNAPSHOT_FILE = ".backend-snapshot.json"

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value)
}

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
			skills: { skillsManager: null },
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
}
