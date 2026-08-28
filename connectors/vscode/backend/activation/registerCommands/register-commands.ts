import * as vscode from "vscode"

import type { CommandId } from "@jabberwock/types"
import { getCommand } from "@utils/mcp/commands"
import type { RegisterCommandOptions } from "./register-commands-map"
import { getCommandsMap } from "./register-commands-map"

export const registerCommands = (options: RegisterCommandOptions) => {
	const { context } = options

	for (const [id, callback] of Object.entries(getCommandsMap(options))) {
		const command = getCommand(id as CommandId)
		context.subscriptions.push(vscode.commands.registerCommand(command, callback))
	}
}
