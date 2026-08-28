// v4 B2 (L4): workspace roots come from the host context DI slot, not vscode directly.
import { getWorkspaceRoots } from "@features/foundation/vscode/context"
import * as os from "os"
import * as path from "path"
import * as fs from "fs/promises"
import type { IBackendRootStore } from "@features/store"
import type { IntentHandlerContext } from "@features/intents/context"
import { t } from "@i18n"
import { getCommands } from "@services/command/commands"
import { openFile } from "@integrations/misc/open-file"
import { getMstState } from "@features/foundation/mst/store"
import { log as backendLog } from "@features/foundation/capabilities/backend-logger"

export function sanitizeCommandName(fileName: string): string {
	if (!fileName || !fileName.trim()) {
		return ""
	}

	let cleanFileName = fileName.trim()
	if (cleanFileName.startsWith("/")) {
		cleanFileName = cleanFileName.substring(1)
	}
	if (cleanFileName.toLowerCase().endsWith(".md")) {
		cleanFileName = cleanFileName.slice(0, -3)
	}

	const slug = cleanFileName
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9-]/g, "")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")

	if (!slug) {
		return ""
	}

	return slug
}

export async function resolveCommandsDir(source: string, ctx: IntentHandlerContext): Promise<string | null> {
	if (source === "global") {
		const globalConfigDir = path.join(os.homedir(), ".jabberwock")
		return path.join(globalConfigDir, "commands")
	}

	if (getWorkspaceRoots().length === 0) {
		publishNotificationError(t("common:errors.no_workspace"))
		return null
	}

	const rootStore = ctx.rootStore as IBackendRootStore
	const workspaceRoot = rootStore.chat.activeTask?.cwd
	if (!workspaceRoot) {
		publishNotificationError(t("common:errors.no_workspace_for_project_command"))
		return null
	}

	return path.join(workspaceRoot, ".jabberwock", "commands")
}

export async function filePathExists(filePath: string): Promise<boolean> {
	return fs
		.access(filePath)
		.then(() => true)
		.catch(() => false)
}

export async function findAvailableCommandName(commandsDir: string): Promise<string> {
	let counter = 1
	let name = "new-command"
	while (await filePathExists(path.join(commandsDir, `${name}.md`))) {
		name = `new-command-${counter}`
		counter++
	}
	return name
}

export async function postCommandsUpdate(
	provider: import("@jabberwock/types").WebviewProvider,
	rootStore: IBackendRootStore,
	cwd: string,
): Promise<void> {
	const commands = await getCommands(cwd)
	const commandList = commands.map((cmd) => ({
		name: cmd.name,
		source: cmd.source,
		filePath: cmd.filePath,
		description: cmd.description,
		argumentHint: cmd.argumentHint,
	}))
	await provider.postMessageToWebview({
		type: "commands",
		commands: commandList,
	})
	getMstState(rootStore).commandsStore?.setCommands(commandList)
}

export async function createCommandFile(
	provider: import("@jabberwock/types").WebviewProvider,
	rootStore: IBackendRootStore,
	payload: { text: string; values: { source: string } },
	ctx: IntentHandlerContext,
): Promise<void> {
	const source = payload.values?.source
	if (!source) {
		backendLog.info("Missing source for createCommand")
		return
	}

	const commandsDir = await resolveCommandsDir(source, ctx)
	if (!commandsDir) {
		return
	}

	await fs.mkdir(commandsDir, { recursive: true })

	const fileName = sanitizeCommandName(payload.text)
	const commandName = fileName || (await findAvailableCommandName(commandsDir))
	const filePath = path.join(commandsDir, `${commandName}.md`)

	if (await filePathExists(filePath)) {
		publishNotificationError(t("common:errors.command_already_exists", { commandName }))
		return
	}

	const templateContent = t("common:errors.command_template_content")
	await fs.writeFile(filePath, templateContent, "utf8")
	backendLog.info(`Created new command file: ${filePath}`)

	openFile(filePath)

	const cwd = rootStore.chat.activeTask?.cwd ?? ""
	await postCommandsUpdate(provider, rootStore, cwd)
}

import { publishNotificationError } from "@features/foundation/capabilities/notifications"
