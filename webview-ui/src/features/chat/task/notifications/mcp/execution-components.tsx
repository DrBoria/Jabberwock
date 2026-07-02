import { memo } from "react"
import { ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { McpExecutionStatus, McpServerRequestData } from "@jabberwock/types"
import { cn } from "@src/lib/utils"
import { Button } from "@src/shared/ui/buttons/button"
import { Container } from "@src/shared/ui/layouts/Container"
import CodeBlock from "@src/features/foundation/components/code/CodeBlock"
import McpToolRow from "@src/features/settings/mcp/components/McpToolRow"
import { Markdown } from "../../messages/components/message-parts/markdown"
import { getStatusLabel, buildToolProps, parseArgumentsText } from "./execution-components-utils"

export { parseArgumentsText }

export const StatusBadge = ({ status }: { status: McpExecutionStatus }) => {
	const { t } = useTranslation("mcp")
	const isRunning = status.status === "started" || status.status === "completed"
	const isError = status.status === "error"
	return (
		<Container $preset="row" $gap="8px" className="font-mono text-xs">
			<div className={cn("rounded-full size-1.5", { "bg-lime-400": isRunning, "bg-red-400": isError })} />
			<div
				className={cn("whitespace-nowrap", {
					"text-vscode-foreground": isRunning,
					"text-vscode-errorForeground": isError,
				})}>
				{getStatusLabel(status, t)}
			</div>
			{isError && "error" in status && status.error && <div className="whitespace-nowrap">({status.error})</div>}
		</Container>
	)
}

export const StatusHeader = ({
	status,
	responseText,
	isResponseExpanded,
	onToggleResponseExpand,
}: {
	status: McpExecutionStatus | null
	responseText: string
	isResponseExpanded: boolean
	onToggleResponseExpand: () => void
}) => (
	<Container $preset="row-reverse" $gap="8px" $p="0 4px">
		{status && <StatusBadge status={status} />}
		{responseText.length > 0 && (
			<Button variant="ghost" size="icon" onClick={onToggleResponseExpand}>
				<ChevronDown
					className={cn("size-4 transition-transform duration-300", { "rotate-180": isResponseExpanded })}
				/>
			</Button>
		)}
	</Container>
)

export const StopPropagation = ({ children }: { children: React.ReactNode }) => (
	<div onClick={(e) => e.stopPropagation()}>{children}</div>
)

export const McpToolRowWithServer = ({
	useMcpServer,
	server,
	alwaysAllowMcp,
}: {
	useMcpServer: McpServerRequestData
	server?: {
		tools?: Array<{ name: string; description?: string; alwaysAllow?: boolean }>
		source?: "global" | "project"
	}
	alwaysAllowMcp: boolean
}) => {
	const tool = server?.tools?.find((t) => t.name === useMcpServer.toolName)
	return (
		<StopPropagation>
			<McpToolRow
				tool={buildToolProps(useMcpServer.toolName, tool?.description, tool?.alwaysAllow)}
				serverName={useMcpServer.serverName}
				serverSource={server?.source}
				alwaysAllowMcp={alwaysAllowMcp}
				isInChatContext
			/>
		</StopPropagation>
	)
}

export const FallbackToolRow = ({
	toolName,
	serverName,
	alwaysAllowMcp,
}: {
	toolName: string
	serverName: string
	alwaysAllowMcp: boolean
}) => (
	<StopPropagation>
		<McpToolRow
			tool={{ name: toolName, description: "", alwaysAllow: false }}
			serverName={serverName}
			serverSource={undefined}
			alwaysAllowMcp={alwaysAllowMcp}
			isInChatContext
		/>
	</StopPropagation>
)

export const ToolSection = ({
	useMcpServer,
	toolName,
	serverName,
	server,
	alwaysAllowMcp,
}: {
	useMcpServer?: McpServerRequestData
	toolName?: string
	serverName?: string
	server?: {
		tools?: Array<{ name: string; description?: string; alwaysAllow?: boolean }>
		source?: "global" | "project"
	}
	alwaysAllowMcp: boolean
}) => {
	if (useMcpServer?.type === "use_mcp_tool")
		return <McpToolRowWithServer useMcpServer={useMcpServer} server={server} alwaysAllowMcp={alwaysAllowMcp} />
	if (!useMcpServer && toolName && serverName)
		return <FallbackToolRow toolName={toolName} serverName={serverName} alwaysAllowMcp={alwaysAllowMcp} />
	return null
}

export const ArgumentsBlock = ({
	isArguments,
	useMcpServer,
	argumentsText,
	formattedText,
	toolName,
	serverName,
}: {
	isArguments: boolean
	useMcpServer?: McpServerRequestData
	argumentsText: string
	formattedText: string
	toolName?: string
	serverName?: string
}) => {
	const shouldShow = isArguments || useMcpServer?.arguments || argumentsText
	if (!shouldShow) return null
	const showTopBorder = !isArguments && (useMcpServer?.type === "use_mcp_tool" || (toolName && serverName))
	return (
		<div className={cn({ "mt-1 pt-1": showTopBorder })}>
			<CodeBlock source={formattedText} language="json" />
		</div>
	)
}

const ResponseContainerInternal = ({
	isExpanded,
	response,
	isJson,
	hasArguments,
	isPartial = false,
}: {
	isExpanded: boolean
	response: string
	isJson: boolean
	hasArguments?: boolean
	isPartial?: boolean
}) => {
	if (!isExpanded || response.length === 0)
		return <div className={cn("overflow-hidden", { "max-h-0": !isExpanded })} />
	return (
		<div
			className={cn("overflow-hidden", {
				"max-h-96 overflow-y-auto mt-1 pt-1 border-t border-border/25": hasArguments,
				"max-h-96 overflow-y-auto mt-1 pt-1": !hasArguments,
			})}>
			{isJson ? (
				<CodeBlock source={response} language="json" />
			) : (
				<Markdown markdown={response} partial={isPartial} />
			)}
		</div>
	)
}

export const ResponseContainer = memo(ResponseContainerInternal)
