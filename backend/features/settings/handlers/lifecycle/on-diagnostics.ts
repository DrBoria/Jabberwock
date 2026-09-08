import * as path from "path"
import * as os from "os"
import * as fs from "fs/promises"
import { getHostContext } from "@features/foundation/host-context/context"
import { IntentType } from "@jabberwock/types"
import { getTaskDirectoryPath } from "@utils/io"
import { fileExistsAtPath } from "@utils/io/fs"
import { diagnosticsManager } from "@jabberwock/devtool"
import { postStateToWebview } from "@features/foundation/window-manager/store"

import type { IntentBus } from "@features/intents/bus"

// ── Exported Types ────────────────────────────────────────────────

export interface ErrorDiagnosticsValues {
	timestamp?: string
	version?: string
	provider?: string
	model?: string
	details?: string
}

interface GenerateDiagnosticsParams {
	taskId: string
	globalStoragePath: string
	values?: ErrorDiagnosticsValues
	log: (message: string) => void
}

interface GenerateDiagnosticsResult {
	success: boolean
	filePath?: string
	error?: string
}

/**
 * Generates an error diagnostics file containing error metadata and API conversation history.
 * The file is created in the system temp directory and opened in VS Code for the user to review
 * before sharing with support.
 */
/** Load API conversation history from the task directory */
async function loadApiConversationHistory(taskDirPath: string): Promise<unknown[]> {
	const apiHistoryPath = path.join(taskDirPath, "api_conversation_history.json")

	if (!(await fileExistsAtPath(apiHistoryPath))) {
		return []
	}

	try {
		const content = await fs.readFile(apiHistoryPath, "utf8")
		return JSON.parse(content) as unknown[]
	} catch {
		publishNotificationError("Failed to parse api_conversation_history.json")
		return []
	}
}

/** Build diagnostics content object from params */
function buildDiagnosticsContent(
	taskDirPath: string,
	history: unknown[],
	values?: ErrorDiagnosticsValues,
): { headerComment: string; fullContent: string; tempFilePath: string } {
	const error: Record<string, string> = {}
	const fieldDefaults = {
		timestamp: () => new Date().toISOString(),
		version: "",
		provider: "",
		model: "",
		details: "",
	}
	for (const [field, defaultVal] of Object.entries(fieldDefaults)) {
		const fieldKey = field as keyof ErrorDiagnosticsValues
		const val = values?.[fieldKey]
		error[field] = val ?? (typeof defaultVal === "function" ? (defaultVal as () => string)() : defaultVal)
	}

	const diagnostics = { error, history }

	const headerComment =
		"// Please share this file with Jabberwock Support (support@jabberwock.com) to diagnose the issue faster\n" +
		"// Just make sure you're OK sharing the contents of the conversation below.\n\n"
	const jsonContent = JSON.stringify(diagnostics, null, 2)
	const fullContent = headerComment + jsonContent

	const tmpDir = os.tmpdir()
	const timestamp = Date.now()
	const tempFileName = `jabberwock-diagnostics-${taskDirPath.slice(0, 8)}-${timestamp}.json`
	const tempFilePath = path.join(tmpDir, tempFileName)

	return { headerComment, fullContent, tempFilePath }
}

/** Write diagnostics to temp file and open in editor */
async function writeAndOpenDiagnostics(fullContent: string, tempFilePath: string): Promise<void> {
	await fs.writeFile(tempFilePath, fullContent, "utf8")
	// D4g-2 (batch 3): open the diagnostics file in the host editor via the hostCommands slot
	// (D4g-pre) — server mode has no host editor, so this degrades to a no-op.
	getHostContext()?.hostCommands?.openFileInEditor?.(tempFilePath, { preview: true })
}

export async function generateErrorDiagnostics(params: GenerateDiagnosticsParams): Promise<GenerateDiagnosticsResult> {
	try {
		const taskDirPath = await getTaskDirectoryPath(params.globalStoragePath, params.taskId)
		const history = await loadApiConversationHistory(taskDirPath)
		const { fullContent, tempFilePath } = buildDiagnosticsContent(taskDirPath, history, params.values)

		await writeAndOpenDiagnostics(fullContent, tempFilePath)

		return { success: true, filePath: tempFilePath }
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		params.log(`Error generating diagnostics: ${errorMessage}`)
		publishNotificationError(`Failed to generate diagnostics: ${errorMessage}`)
		return { success: false, error: errorMessage }
	}
}

/**
 * Register all diagnostics-related intent handlers on the bus.
 */
export function registerOnSettingsDiagnostics(bus: IntentBus): void {
	bus.register(IntentType.DiagnosticsClear, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		diagnosticsManager.clear()
		await postStateToWebview(provider)
	})
}

import { publishNotificationError } from "@features/foundation/capabilities/notifications"
