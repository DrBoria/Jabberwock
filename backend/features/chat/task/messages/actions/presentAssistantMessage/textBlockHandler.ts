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

	// During active streaming, skip the MST agentBroadcast for partial text blocks.
	// The fast path (sendStreamChunk → StreamingFooter) provides real-time rendering.
	if (block.partial && task._state.isStreaming) {
		return
	}

	await agentBroadcast(task.taskId, "text", content, undefined, block.partial)
}

export { handleTextBlockContent }
