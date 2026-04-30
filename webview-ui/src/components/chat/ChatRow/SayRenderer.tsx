import React from "react"
import type { ClineMessage } from "@jabberwock/types"
import { Markdown } from "../Markdown"
import { ReasoningBlock } from "../ReasoningBlock"
import { ErrorRow } from "../ErrorRow"
import { CommandExecutionError } from "../CommandExecutionError"
import { Container } from "@src/components/ui"
import { McpIframeRenderer } from "../../../features/mcp-apps/McpIframeRenderer"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { getAllModes } from "@shared/modes"
import {
	TextSay,
	SayTool,
	ApiReqStartedSay,
	ApiReqRetryDelayedSay,
	ApiReqRateLimitWaitSay,
	ErrorSay,
	UserFeedbackSay,
	UserFeedbackDiffSay,
	SubtaskResultSay,
	CompletionResultSay,
	ImageSay,
	TooManyToolsWarningSay,
	CheckpointSavedSay,
	CodebaseSearchResultSay,
	UpdateTodoListSay,
	CondenseContextSay,
	SlidingWindowTruncationSay,
	CondensationErrorSay,
} from "./Say"

interface SayRendererProps {
	message: ClineMessage
	lastModifiedMessage?: ClineMessage
	isExpanded: boolean
	isLast: boolean
	isStreaming: boolean
	isNested: boolean
	isRedundantDelegation: boolean
	isAgentSaidSummary: boolean
	modeName: string | undefined
	icon: React.ReactNode
	title: React.ReactNode
	onToggleExpand: () => void
	onSuggestionClick?: (suggestion: any, event?: React.MouseEvent) => void
	t: (key: string, options?: any) => string
	i18n: any
}

/** Main SayRenderer - dispatches to sub-renderers via object-literal pattern */
export const SayRenderer: React.FC<SayRendererProps> = (props) => {
	const { message, icon, title, isExpanded, onToggleExpand, t, i18n } = props
	const { customModes } = useExtensionState()

	// Parse interactive app metadata from mcp_server_response messages
	const interactiveMeta = React.useMemo<{ resourceUri?: string; input?: Record<string, unknown> } | null>(() => {
		if (message.say === "mcp_server_response" && message.text) {
			try {
				const parsed = JSON.parse(message.text) as {
					_interactiveMeta?: { resourceUri?: string; input?: Record<string, unknown> }
				}
				if (parsed._interactiveMeta?.resourceUri) {
					return parsed._interactiveMeta as { resourceUri: string; input?: Record<string, unknown> }
				}
			} catch {
				// Not JSON, not an interactive app response
			}
		}
		return null
	}, [message.say, message.text])

	const agentsList = React.useMemo(() => {
		return JSON.stringify(
			getAllModes(customModes)
				.map((m: any) => ({ slug: m.slug, name: m.name }))
				.filter(Boolean),
		)
	}, [customModes])

	const dispatchers: Record<string, () => React.ReactNode> = {
		api_req_finished: () => null,
		diff_error: () => <ErrorRow type="diff_error" message={message.text || ""} expandable showCopyButton />,
		subtask_result: () => <SubtaskResultSay message={message} t={t} />,
		reasoning: () => (
			<ReasoningBlock
				content={message.text || ""}
				ts={message.ts}
				isStreaming={props.isStreaming}
				isLast={props.isLast}
			/>
		),
		api_req_started: () => (
			<ApiReqStartedSay
				message={message}
				isLast={props.isLast}
				lastModifiedMessage={props.lastModifiedMessage}
				icon={icon}
				title={title}
				t={t}
			/>
		),
		api_req_retry_delayed: () => <ApiReqRetryDelayedSay message={message} t={t} i18n={i18n} />,
		api_req_rate_limit_wait: () => <ApiReqRateLimitWaitSay message={message} t={t} />,
		text: () => (
			<TextSay
				message={message}
				isExpanded={isExpanded}
				isRedundantDelegation={props.isRedundantDelegation}
				isAgentSaidSummary={props.isAgentSaidSummary}
				modeName={props.modeName}
				isStreaming={props.isStreaming}
				onToggleExpand={onToggleExpand}
				t={t}
			/>
		),
		user_feedback: () => <UserFeedbackSay message={message} isStreaming={props.isStreaming} t={t} />,
		user_feedback_diff: () => (
			<UserFeedbackDiffSay message={message} isExpanded={isExpanded} onToggleExpand={onToggleExpand} />
		),
		error: () => <ErrorSay message={message} t={t} />,
		completion_result: () => <CompletionResultSay message={message} icon={icon} title={title} />,
		shell_integration_warning: () => <CommandExecutionError />,
		checkpoint_saved: () => <CheckpointSavedSay message={message} />,
		condense_context: () => <CondenseContextSay message={message} />,
		condense_context_error: () => <CondensationErrorSay message={message} />,
		sliding_window_truncation: () => <SlidingWindowTruncationSay message={message} />,
		codebase_search_result: () => <CodebaseSearchResultSay message={message} />,
		user_edit_todos: () => <UpdateTodoListSay message={message} />,
		tool: () => <SayTool message={message} t={t} />,
		image: () => <ImageSay message={message} />,
		too_many_tools_warning: () => <TooManyToolsWarningSay message={message} t={t} />,
		mcp_server_response: () => {
			if (interactiveMeta?.resourceUri) {
				// Render the interactive app iframe (e.g., md-todo-mcp todo list)
				// The JSON response text is shown only when the message is expanded
				let responseText: string | undefined
				if (message.text) {
					try {
						const parsed = JSON.parse(message.text) as { response?: string }
						responseText = parsed.response
					} catch {
						responseText = message.text
					}
				}
				return (
					<>
						{title && (
							<Container preset="header" p="0">
								{icon}
								{title}
							</Container>
						)}
						<div className="mt-2">
							<McpIframeRenderer
								resourceUri={interactiveMeta.resourceUri}
								agentsList={agentsList}
								inputData={interactiveMeta.input ? JSON.stringify(interactiveMeta.input) : undefined}
								readOnly
							/>
						</div>
						{isExpanded && responseText && (
							<div style={{ paddingTop: 10 }}>
								<Markdown markdown={responseText} partial={message.partial} />
							</div>
						)}
					</>
				)
			}
			// Fall through to default rendering for regular MCP responses
			return null
		},
	}

	const dispatcherResult = dispatchers[message.say ?? ""]?.()

	return (
		dispatcherResult ?? (
			<>
				{title && (
					<Container preset="header" p="0">
						{icon}
						{title}
					</Container>
				)}
				<div style={{ paddingTop: 10 }}>
					<Markdown markdown={message.text} partial={message.partial} />
				</div>
			</>
		)
	)
}
