import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"

import type { McpTool } from "@jabberwock/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { rootStore } from "@src/features/store"
import { ToggleSwitch } from "@src/shared/ui/buttons/toggle-switch"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"

type McpToolRowProps = {
	tool: McpTool
	serverName?: string
	serverSource?: "global" | "project"
	alwaysAllowMcp?: boolean
	isInChatContext?: boolean
}

function getIconClass(isToolEnabled: boolean): string {
	const base = "codicon codicon-symbol-method mr-2 flex-shrink-0"
	if (!isToolEnabled) {
		return base + " text-vscode-descriptionForeground opacity-60"
	}
	return base + " text-vscode-symbolIcon-methodForeground"
}

function getNameClass(isToolEnabled: boolean): string {
	const base = "font-medium truncate"
	if (!isToolEnabled) {
		return base + " text-vscode-descriptionForeground opacity-60"
	}
	return base + " text-vscode-foreground"
}

function getDescClass(isToolEnabled: boolean): string {
	const base = "mt-1 text-xs text-vscode-descriptionForeground"
	if (!isToolEnabled) {
		return base + " opacity-40"
	}
	return base + " opacity-80"
}

function isParamRequired(inputSchema: McpTool["inputSchema"], paramName: string): boolean {
	if (!inputSchema) return false
	if (!("required" in inputSchema)) return false
	if (!Array.isArray(inputSchema.required)) return false
	return inputSchema.required.includes(paramName)
}

function McpToolParameters({ tool, t }: { tool: McpTool; t: (key: string) => string }) {
	if (!tool.inputSchema) return null
	if (!("properties" in tool.inputSchema)) return null
	const properties = tool.inputSchema.properties as Record<string, { description?: string }> | undefined
	if (!properties) return null
	const keys = Object.keys(properties)
	if (keys.length === 0) return null

	return (
		<div className="mt-2 text-xs border border-vscode-panel-border rounded p-2">
			<div className="mb-1 text-[11px] uppercase opacity-80 text-vscode-descriptionForeground">
				{t("mcp:tool.parameters")}
			</div>
			{keys.map((paramName) => {
				const schema = properties[paramName]
				const required = isParamRequired(tool.inputSchema, paramName)
				return (
					<div key={paramName} className="flex items-baseline mt-1">
						<code className="text-vscode-textPreformat-foreground mr-2">
							{paramName}
							{required && <span className="text-vscode-errorForeground">*</span>}
						</code>
						<span className="opacity-80 break-words text-vscode-descriptionForeground">
							{schema?.description || t("mcp:tool.noDescription")}
						</span>
					</div>
				)
			})}
		</div>
	)
}

function handleAlwaysAllowChange(tool: McpTool, serverName: string, serverSource: "global" | "project"): void {
	rootStore.settings.toggleToolAlwaysAllow(serverName, serverSource, tool.name, !tool.alwaysAllow)
}

function handleEnabledForPromptChange(tool: McpTool, serverName: string, serverSource: "global" | "project"): void {
	rootStore.settings.toggleToolEnabledForPrompt(serverName, serverSource, tool.name, !tool.enabledForPrompt)
}

const McpToolRow = ({ tool, serverName, serverSource, alwaysAllowMcp, isInChatContext = false }: McpToolRowProps) => {
	const { t } = useAppTranslation()
	const isToolEnabled = tool.enabledForPrompt !== false
	const showAlwaysAllow = alwaysAllowMcp && isToolEnabled
	const showToggle = !isInChatContext
	const showDescription = tool.description !== null && tool.description !== undefined
	const sn = serverName ?? ""
	const src = serverSource ?? "global"

	return (
		<div key={tool.name} className="py-2 border-b border-vscode-panel-border last:border-b-0">
			<div
				data-testid="tool-row-container"
				className="flex items-center gap-4"
				onClick={(e) => e.stopPropagation()}>
				{/* Tool name section */}
				<div className="flex items-center min-w-0 flex-1">
					<span className={getIconClass(isToolEnabled)}></span>
					<StandardTooltip content={tool.name}>
						<span className={getNameClass(isToolEnabled)}>{tool.name}</span>
					</StandardTooltip>
				</div>

				{/* Controls section */}
				{serverName && (
					<div className="flex items-center gap-4 flex-shrink-0">
						{/* Always Allow checkbox - only show when tool is enabled */}
						{showAlwaysAllow && (
							<VSCodeCheckbox
								checked={tool.alwaysAllow}
								onChange={() => handleAlwaysAllowChange(tool, sn, src)}
								data-tool={tool.name}
								className="text-xs">
								<span className="text-vscode-descriptionForeground whitespace-nowrap">
									{t("mcp:tool.alwaysAllow")}
								</span>
							</VSCodeCheckbox>
						)}

						{/* Enabled toggle switch - only show in settings context */}
						{showToggle && (
							<StandardTooltip content={t("mcp:tool.togglePromptInclusion")}>
								<ToggleSwitch
									checked={isToolEnabled}
									onChange={() => handleEnabledForPromptChange(tool, sn, src)}
									size="medium"
									aria-label={t("mcp:tool.togglePromptInclusion")}
									data-testid={`tool-prompt-toggle-${tool.name}`}
								/>
							</StandardTooltip>
						)}
					</div>
				)}
			</div>
			{showDescription && <div className={getDescClass(isToolEnabled)}>{tool.description}</div>}
			<McpToolParameters tool={tool} t={t} />
		</div>
	)
}

export default McpToolRow
