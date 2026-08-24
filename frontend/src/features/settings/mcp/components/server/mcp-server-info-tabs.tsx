import { VSCodePanels, VSCodePanelTab, VSCodePanelView } from "@vscode/webview-ui-toolkit/react"
import type { McpServer } from "@jabberwock/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import {
	ToolsPanelView,
	ResourcesPanelView,
	InstructionsPanelView,
	LogsPanelView,
	orZero,
	orEmpty,
} from "../mcp-panel-views"

export const ServerInfoTabs = ({ server, alwaysAllowMcp }: { server: McpServer; alwaysAllowMcp?: boolean }) => {
	const { t } = useAppTranslation()
	const hasResources = [server.resources, server.resourceTemplates].some((r) => r && r.length > 0)
	const combinedResources = [...orEmpty(server.resourceTemplates), ...orEmpty(server.resources)]
	return (
		<VSCodePanels style={{ marginBottom: "10px" }}>
			<VSCodePanelTab id="tools">
				{t("mcp:tabs.tools")} ({orZero(server.tools?.length)})
			</VSCodePanelTab>
			<VSCodePanelTab id="resources">
				{t("mcp:tabs.resources")} ({orZero(combinedResources.length)})
			</VSCodePanelTab>
			{server.instructions && <VSCodePanelTab id="instructions">{t("mcp:instructions")}</VSCodePanelTab>}
			<VSCodePanelTab id="logs">
				{t("mcp:tabs.logs")} ({orZero(server.errorHistory?.length)})
			</VSCodePanelTab>
			<VSCodePanelView id="tools-view">
				<ToolsPanelView server={server} alwaysAllowMcp={alwaysAllowMcp} />
			</VSCodePanelView>
			<VSCodePanelView id="resources-view">
				<ResourcesPanelView combinedResources={combinedResources} hasResources={hasResources} />
			</VSCodePanelView>
			{server.instructions && (
				<VSCodePanelView id="instructions-view">
					<InstructionsPanelView instructions={server.instructions} />
				</VSCodePanelView>
			)}
			<VSCodePanelView id="logs-view">
				<LogsPanelView errorHistory={server.errorHistory} />
			</VSCodePanelView>
		</VSCodePanels>
	)
}
