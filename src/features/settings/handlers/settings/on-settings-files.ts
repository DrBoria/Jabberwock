import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import * as vscode from "vscode"
import * as path from "path"
import * as os from "os"
import * as fs from "fs/promises"
import { openFile } from "@integrations/misc/open-file"
import { openImage, saveImage } from "@integrations/misc/image-handler"
import { openMention } from "@features/chat/task/messages/actions/mentions/parseMentions"
import { resolveDefaultSaveUri, saveLastExportPath } from "@utils/io/export"
import { isPathOutsideWorkspace } from "@utils/io"
import { getSettingsAccess } from "@utils/settings"

/**
 * Register all file settings intent handlers.
 */
export function registerOnSettingsFiles(bus: IntentBus): void {
	// ── openImage ─────────────────────────────────────────────────────
	bus.register(IntentType.SettingsFileImageOpen, async (intent, _ctx) => {
		const payload = intent.payload as {
			text: string
			values?: { create?: boolean; content?: string; line?: number }
		}
		openImage(payload.text, { values: payload.values as { action?: string } | undefined })
	})

	// ── saveImage ─────────────────────────────────────────────────────
	bus.register(IntentType.SettingsFileImageSave, async (intent, _ctx) => {
		const payload = intent.payload as { dataUri: string }
		if (!payload.dataUri) return

		const matches = payload.dataUri.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/)
		if (!matches) {
			saveImage(payload.dataUri, vscode.Uri.file(""))
			return
		}
		const format = matches[1]
		const defaultFileName = `img_${Date.now()}.${format}`

		const defaultUri = await resolveDefaultSaveUri(getSettingsAccess(), "lastImageSavePath", defaultFileName, {
			useWorkspace: false,
			fallbackDir: path.join(os.homedir(), "Downloads"),
		})

		const savedUri = await saveImage(payload.dataUri, defaultUri)

		if (savedUri) {
			await saveLastExportPath(getSettingsAccess(), "lastImageSavePath", savedUri)
		}
	})

	// ── openFile ──────────────────────────────────────────────────────
	bus.register(IntentType.SettingsFileOpen, async (intent, ctx) => {
		const payload = intent.payload as {
			text: string
			values?: { create?: boolean; content?: string; line?: number }
		}

		const getCurrentCwd = (): string => {
			return ctx.rootStore.chat.activeTask?.cwd ?? ""
		}
		let filePath: string = payload.text
		if (!path.isAbsolute(filePath)) {
			filePath = path.join(getCurrentCwd(), filePath)
		}
		openFile(filePath, payload.values)
	})

	// ── readFileContent ──────────────────────────────────────────────
	bus.register(IntentType.SettingsFileContentRead, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as { text: string }

		const getCurrentCwd = () => {
			return ctx.rootStore.chat.activeTask?.cwd
		}
		const relPath = payload.text || ""
		if (!relPath) {
			provider.postMessageToWebview({
				type: "fileContent",
				fileContent: { path: relPath, content: null, error: "No path provided" },
			})
			return
		}
		try {
			const cwd = getCurrentCwd()
			if (!cwd) {
				provider.postMessageToWebview({
					type: "fileContent",
					fileContent: { path: relPath, content: null, error: "No workspace path available" },
				})
				return
			}
			const absPath = path.resolve(cwd, relPath)
			if (isPathOutsideWorkspace(absPath)) {
				provider.postMessageToWebview({
					type: "fileContent",
					fileContent: { path: relPath, content: null, error: "Path is outside workspace" },
				})
				return
			}
			const content = await fs.readFile(absPath, "utf-8")
			provider.postMessageToWebview({ type: "fileContent", fileContent: { path: relPath, content } })
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err)
			provider.postMessageToWebview({
				type: "fileContent",
				fileContent: { path: relPath, content: null, error: errorMsg },
			})
		}
	})

	// ── openExternal ──────────────────────────────────────────────────
	bus.register(IntentType.SettingsFileExternalOpen, async (intent) => {
		const payload = intent.payload as { url: string }
		if (payload.url) {
			vscode.env.openExternal(vscode.Uri.parse(payload.url))
		}
	})

	// ── openMention ───────────────────────────────────────────────────
	bus.register(IntentType.SettingsFileMentionOpen, async (intent, ctx) => {
		const payload = intent.payload as { text: string }

		const getCurrentCwd = (): string => {
			return ctx.rootStore.chat.activeTask?.cwd ?? ""
		}
		openMention(getCurrentCwd(), payload.text)
	})
}
