import * as vscode from "vscode"

import { TerminalActionId, TerminalActionPromptType } from "@jabberwock/types"

import { getTerminalCommand } from "../utils/commands"
import { EventBridge } from "../core/webview/EventBridge"
import { Terminal } from "../integrations/terminal/Terminal"
import { t } from "../i18n"
import { handleTerminalAction } from "../features/foundation/agent-state/handlers"

export const registerTerminalActions = (context: vscode.ExtensionContext) => {
	registerTerminalAction(context, "terminalAddToContext", "TERMINAL_ADD_TO_CONTEXT")
	registerTerminalAction(context, "terminalFixCommand", "TERMINAL_FIX")
	registerTerminalAction(context, "terminalExplainCommand", "TERMINAL_EXPLAIN")
}

const registerTerminalAction = (
	context: vscode.ExtensionContext,
	command: TerminalActionId,
	promptType: TerminalActionPromptType,
) => {
	context.subscriptions.push(
		vscode.commands.registerCommand(getTerminalCommand(command), async (args: unknown) => {
			let content = (args as { selection?: string })?.selection

			if (!content || content === "") {
				content = await Terminal.getTerminalContents(promptType === "TERMINAL_ADD_TO_CONTEXT" ? -1 : 1)
			}

			if (!content) {
				vscode.window.showWarningMessage(t("common:warnings.no_terminal_content"))
				return
			}

			const provider = EventBridge.getFirstAvailableInstance()
			if (provider) {
				await handleTerminalAction(provider, {
					type: "handleTerminalAction",
					command,
					promptType,
					params: { terminalContent: content },
				})
			}
		}),
	)
}
