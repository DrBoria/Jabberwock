import { memo } from "react"
import { Box, Newline, Text } from "ink"

import type { TUIMessage } from "../../types.js"
import * as theme from "../../theme.js"

import TodoDisplay from "./TodoDisplay.js"
import { getToolRenderer } from "../tools/index.js"
import { sanitizeContent } from "./chatHistoryHelpers.js"
import { ToolDisplay } from "./ToolDisplay.js"

interface ChatHistoryItemProps {
	message: TUIMessage
}

function renderUserMessage(content: string) {
	return (
		<Box flexDirection="column" paddingX={1}>
			<Text bold color="magenta">
				You said:
			</Text>
			<Text color={theme.userText}>
				{content}
				<Newline />
			</Text>
		</Box>
	)
}

function renderAssistantMessage(content: string) {
	return (
		<Box flexDirection="column" paddingX={1}>
			<Text bold color="yellow">
				Jabberwock said:
			</Text>
			<Text color={theme.jabberwockText}>
				{content}
				<Newline />
			</Text>
		</Box>
	)
}

function renderThinkingMessage(content: string) {
	return (
		<Box flexDirection="column" paddingX={1}>
			<Text bold color={theme.thinkingHeader} dimColor>
				Jabberwock is thinking:
			</Text>
			<Text color={theme.thinkingText} dimColor>
				{content}
				<Newline />
			</Text>
		</Box>
	)
}

function renderToolMessage(message: TUIMessage) {
	if (
		(message.toolName === "update_todo_list" || message.toolName === "updateTodoList") &&
		message.todos !== undefined &&
		message.todos.length > 0
	) {
		return <TodoDisplay todos={message.todos} previousTodos={message.previousTodos} showProgress={true} />
	}
	if (message.toolData) {
		const ToolRenderer = getToolRenderer(message.toolData.tool)
		return <ToolRenderer toolData={message.toolData} rawContent={message.content} />
	}
	return <ToolDisplay message={message} />
}

function renderSystemMessage(content: string) {
	return (
		<Box flexDirection="column" paddingX={1}>
			<Text color="gray" dimColor>
				{content}
				<Newline />
			</Text>
		</Box>
	)
}

function ChatHistoryItem({ message }: ChatHistoryItemProps) {
	const content = sanitizeContent(message.content || "...")
	switch (message.role) {
		case "user":
			return renderUserMessage(content)
		case "assistant":
			return renderAssistantMessage(content)
		case "thinking":
			return renderThinkingMessage(content)
		case "tool":
			return renderToolMessage(message)
		case "system":
			return renderSystemMessage(content)
		default:
			return null
	}
}

export default memo(ChatHistoryItem)
