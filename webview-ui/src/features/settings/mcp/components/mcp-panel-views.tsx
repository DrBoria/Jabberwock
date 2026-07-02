import type { McpServer, McpResource, McpResourceTemplate } from "@jabberwock/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import McpToolRow from "./McpToolRow"
import McpResourceRow from "./McpResourceRow"
import { McpErrorRow } from "./McpErrorRow"

const orZero = (n: number | null | undefined) => n ?? 0
const orEmpty = <T,>(arr: T[] | null | undefined) => arr ?? []

export { orZero, orEmpty }

export const ToolsPanelView = ({ server, alwaysAllowMcp }: { server: McpServer; alwaysAllowMcp?: boolean }) => {
	const { t } = useAppTranslation()
	return server.tools && server.tools.length > 0 ? (
		<div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
			{server.tools.map((tool) => (
				<McpToolRow
					key={`${tool.name}-${server.name}-${server.source || "global"}`}
					tool={tool}
					serverName={server.name}
					serverSource={server.source || "global"}
					alwaysAllowMcp={alwaysAllowMcp}
				/>
			))}
		</div>
	) : (
		<div style={{ padding: "10px 0", color: "var(--vscode-descriptionForeground)" }}>
			{t("mcp:emptyState.noTools")}
		</div>
	)
}

export const ResourcesPanelView = ({
	combinedResources,
	hasResources,
}: {
	combinedResources: Array<McpResource | McpResourceTemplate>
	hasResources: boolean
}) => {
	const { t } = useAppTranslation()
	return hasResources ? (
		<div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
			{combinedResources.map((item) => (
				<McpResourceRow key={"uriTemplate" in item ? item.uriTemplate : item.uri} item={item} />
			))}
		</div>
	) : (
		<div style={{ padding: "10px 0", color: "var(--vscode-descriptionForeground)" }}>
			{t("mcp:emptyState.noResources")}
		</div>
	)
}

export const InstructionsPanelView = ({ instructions }: { instructions: string }) => (
	<div style={{ padding: "10px 0", fontSize: "12px" }}>
		<div className="opacity-80 whitespace-pre-wrap break-words">{instructions}</div>
	</div>
)

export const LogsPanelView = ({ errorHistory }: { errorHistory: McpServer["errorHistory"] }) => {
	const { t } = useAppTranslation()
	return errorHistory && errorHistory.length > 0 ? (
		<div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
			{[...errorHistory]
				.sort((a, b) => b.timestamp - a.timestamp)
				.map((error, index) => (
					<McpErrorRow key={`${error.timestamp}-${index}`} error={error} />
				))}
		</div>
	) : (
		<div style={{ padding: "10px 0", color: "var(--vscode-descriptionForeground)" }}>
			{t("mcp:emptyState.noLogs")}
		</div>
	)
}
