import type { ITaskModel } from "@features/chat/task/store"
import type { TextContent } from "@shared/tools"
import type { AssistantMessageContent } from "@features/chat/task/messages/actions/types"
import { agentBroadcast } from "@features/chat/task/messages/actions/say"

async function handleTextBlockContent(task: ITaskModel, block: AssistantMessageContent): Promise<void> {
	if (task._state.didRejectTool || task._state.didAlreadyUseTool) {
		return
	}

	let content = (block as TextContent).text

	if (content) {
		content = content.replace(/<thinking>\s?/g, "")
		content = content.replace(/\s?<\/thinking>/g, "")
	}

	await agentBroadcast(task.taskId, "text", content, undefined, block.partial)
}

export { handleTextBlockContent }
