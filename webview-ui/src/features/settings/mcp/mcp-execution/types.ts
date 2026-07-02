import type { McpServerRequestData, McpExecutionStatus } from "@jabberwock/types"

export interface McpExecutionProps {
	executionId: string
	text?: string
	serverName?: string
	toolName?: string
	isArguments?: boolean
	server?: {
		tools?: Array<{ name: string; description?: string; alwaysAllow?: boolean }>
		source?: "global" | "project"
	}
	useMcpServer?: McpServerRequestData
	alwaysAllowMcp?: boolean
}

export interface UseMcpExecutionStateResult {
	t: (key: string) => string
	status: McpExecutionStatus | null
	responseText: string
	argumentsText: string
	serverName?: string
	toolName?: string
	isResponseExpanded: boolean
	responseIsJson: boolean
	formattedResponseText: string
	formattedArgumentsText: string
	isUseMcpTool: boolean
	hasToolNameAndServer: boolean
	isPartial: boolean
	showToolSection: boolean
	hasArguments: boolean
	onToggleResponseExpand: () => void
}

export interface StatusIndicatorProps {
	status: McpExecutionStatus | null
	t: (key: string) => string
}

export interface ExpandChevronProps {
	responseText: string
	isExpanded: boolean
	onToggle: () => void
}

export interface StatusBarProps {
	status: McpExecutionStatus | null
	serverName?: string
	responseText: string
	isResponseExpanded: boolean
	onToggleResponseExpand: () => void
	t: (key: string) => string
}

export interface UseMcpToolRowProps {
	useMcpServer: McpServerRequestData
	server?: McpExecutionProps["server"]
	alwaysAllowMcp: boolean
}

export interface LegacyToolRowProps {
	toolName?: string
	serverName?: string
	alwaysAllowMcp: boolean
}

export interface ToolSectionProps {
	useMcpServer?: McpServerRequestData
	server?: McpExecutionProps["server"]
	toolName?: string
	serverName?: string
	alwaysAllowMcp: boolean
}

export interface ArgumentsSectionProps {
	formattedArgumentsText: string
	isArguments: boolean
	isUseMcpTool: boolean
	hasToolNameAndServer: boolean
}

export interface UseMcpExecutionStateParams {
	executionId: string
	text?: string
	useMcpServer?: McpServerRequestData
	serverName?: string
	toolName?: string
	isArguments: boolean
}

export interface ResponseContainerProps {
	isExpanded: boolean
	response: string
	isJson: boolean
	hasArguments?: boolean
	isPartial?: boolean
}
