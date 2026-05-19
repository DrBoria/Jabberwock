import type { EventBridge } from "./EventBridge"
import type { HandlerFn, HandlerMessage } from "./types"

import { handlerMap as chatMessagesListHandlers } from "../../features/chat/messages-list/handlers"
import { handlerMap as chatNotificationsHandlers } from "../../features/chat/notifications/handlers"
import { handlerMap as chatTaskHandlers } from "../../features/chat/task/handlers"
import { handlerMap as chatTextAreaHandlers } from "../../features/chat/text-area/handlers"
import { handlerMap as chatTopicHandlers } from "../../features/chat/topic/handlers"
import { handlerMap as cloudHandlers } from "../../features/cloud/handlers"
import { handlerMap as diagnosticsHandlers } from "../../features/diagnostics/handlers"
import { handlerMap as foundationAgentStateHandlers } from "../../features/foundation/agent-state/handlers"
import { handlerMap as foundationWindowManagerHandlers } from "../../features/foundation/window-manager/handlers"
import { handlerMap as historyHandlers } from "../../features/history/handlers"
import { handlerMap as marketplaceHandlers } from "../../features/marketplace/handlers"
import { handlerMap as settingsHandlers } from "../../features/settings/handlers"
import { handlerMap as settingsApiConfigHandlers } from "../../features/settings/api-config/handlers"
import { handlerMap as settingsCodeIndexHandlers } from "../../features/settings/code-index/handlers"
import { handlerMap as settingsCommandsHandlers } from "../../features/settings/commands/handlers"
import { handlerMap as settingsDebugHandlers } from "../../features/settings/debug/handlers"
import { handlerMap as settingsFilesHandlers } from "../../features/settings/files/handlers"
import { handlerMap as settingsMcpHandlers } from "../../features/settings/mcp/handlers"
import { handlerMap as settingsModesHandlers } from "../../features/settings/modes/handlers"
import { handlerMap as settingsModelsHandlers } from "../../features/settings/models/handlers"
import { handlerMap as settingsPromptsHandlers } from "../../features/settings/prompts/handlers"
import { handlerMap as settingsVscodeHandlers } from "../../features/settings/vscode/handlers"
import { handlerMap as settingsWebviewHandlers } from "../../features/settings/webview/handlers"
import { handlerMap as settingsWorktreeHandlers } from "../../features/settings/worktree/handlers"
import { handlerMap as skillsHandlers } from "../../features/settings/skills/handlers"

const handlerMap: Record<string, HandlerFn> = {
	...chatMessagesListHandlers,
	...chatNotificationsHandlers,
	...chatTaskHandlers,
	...chatTextAreaHandlers,
	...chatTopicHandlers,
	...cloudHandlers,
	...diagnosticsHandlers,
	...foundationAgentStateHandlers,
	...foundationWindowManagerHandlers,
	...historyHandlers,
	...marketplaceHandlers,
	...settingsHandlers,
	...settingsApiConfigHandlers,
	...settingsCodeIndexHandlers,
	...settingsCommandsHandlers,
	...settingsDebugHandlers,
	...settingsFilesHandlers,
	...settingsMcpHandlers,
	...settingsModesHandlers,
	...settingsModelsHandlers,
	...settingsPromptsHandlers,
	...settingsVscodeHandlers,
	...settingsWebviewHandlers,
	...settingsWorktreeHandlers,
	...skillsHandlers,
}

export const webviewMessageHandler = async (provider: EventBridge, message: Record<string, unknown>): Promise<void> => {
	const type = String(message.type ?? "")
	const handler = handlerMap[type]
	if (handler) {
		try {
			await handler(provider, message as HandlerMessage)
		} catch (error) {
			console.error(
				`[DEBUG:MSG] webviewMessageHandler ERROR in handler for type "${type}":`,
				error instanceof Error ? error.message : String(error),
			)
		}
	}
}
