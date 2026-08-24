import { Trans } from "react-i18next"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import type { McpServer } from "@jabberwock/types"
import { rootStore } from "@src/features/store"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useTooManyTools } from "@src/hooks/useTooManyTools"
import { Button } from "@src/shared/ui/buttons/button"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import { buildDocLink } from "@/utils/misc/docLinks"
import { Section } from "@src/features/settings/components/shared/Section"
import { SectionHeader } from "@src/features/settings/components/shared/SectionHeader"
import { ServerRow } from "./server/mcp-server-components"
import McpEnabledToggle from "./McpEnabledToggle"

const TooManyToolsWarning = ({
	isOverThreshold,
	title,
	message,
}: {
	isOverThreshold: boolean
	title: string
	message: string
}) =>
	isOverThreshold ? (
		<div style={{ marginBottom: 15 }}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "6px",
					fontWeight: "500",
					color: "var(--vscode-editorWarning-foreground)",
					marginBottom: "5px",
				}}>
				<span className="codicon codicon-warning" />
				{title}
			</div>
			<div style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)" }}>{message}</div>
		</div>
	) : null

const ServerList = ({ servers, alwaysAllowMcp }: { servers: McpServer[]; alwaysAllowMcp?: boolean }) =>
	servers.length === 0 ? null : (
		<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
			{servers.map((s) => (
				<ServerRow key={`${s.name}-${s.source || "global"}`} server={s} alwaysAllowMcp={alwaysAllowMcp} />
			))}
		</div>
	)

const SettingsActionButtons = () => {
	const { t } = useAppTranslation()
	return (
		<div
			style={{
				marginTop: "10px",
				width: "100%",
				display: "grid",
				gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
				gap: "10px",
			}}>
			<Button variant="secondary" style={{ width: "100%" }} onClick={() => rootStore.settings.openMcpSettings()}>
				<span className="codicon codicon-edit" style={{ marginRight: "6px" }} />
				{t("mcp:editGlobalMCP")}
			</Button>
			<Button
				variant="secondary"
				style={{ width: "100%" }}
				onClick={() => rootStore.settings.openProjectMcpSettings()}>
				<span className="codicon codicon-edit" style={{ marginRight: "6px" }} />
				{t("mcp:editProjectMCP")}
			</Button>
			<Button
				variant="secondary"
				style={{ width: "100%" }}
				onClick={() => rootStore.settings.refreshAllMcpServers()}>
				<span className="codicon codicon-refresh" style={{ marginRight: "6px" }} />
				{t("mcp:refreshMCP")}
			</Button>
			<StandardTooltip content={t("mcp:marketplace")}>
				<Button
					variant="secondary"
					style={{ width: "100%" }}
					onClick={() =>
						window.postMessage(
							{ type: "action", action: "marketplaceButtonClicked", values: { marketplaceTab: "mcp" } },
							"*",
						)
					}>
					<span className="codicon codicon-extensions" style={{ marginRight: "6px" }} />
					{t("mcp:marketplace")}
				</Button>
			</StandardTooltip>
		</div>
	)
}

const McpView = () => {
	const servers = rootStore.settings.mcpServers,
		alwaysAllowMcp = rootStore.extensionState.alwaysAllowMcp,
		mcpEnabled = rootStore.extensionState.mcpEnabled,
		{ t } = useAppTranslation(),
		{ isOverThreshold, title, message } = useTooManyTools()
	return (
		<div>
			<SectionHeader>{t("mcp:title")}</SectionHeader>
			<Section>
				<div
					style={{
						color: "var(--vscode-foreground)",
						fontSize: "13px",
						marginBottom: "10px",
						marginTop: "5px",
					}}>
					<Trans i18nKey="mcp:description">
						<VSCodeLink
							href={buildDocLink("features/mcp/using-mcp-in-jabberwock", "mcp_settings")}
							style={{ display: "inline" }}>
							Learn More
						</VSCodeLink>
					</Trans>
				</div>
				<McpEnabledToggle />
				{mcpEnabled && (
					<>
						<TooManyToolsWarning isOverThreshold={isOverThreshold} title={title} message={message} />
						<ServerList servers={servers} alwaysAllowMcp={alwaysAllowMcp} />
						<SettingsActionButtons />
						<div
							style={{
								marginTop: "15px",
								fontSize: "12px",
								color: "var(--vscode-descriptionForeground)",
							}}>
							<VSCodeLink
								href={buildDocLink(
									"features/mcp/using-mcp-in-jabberwock#editing-mcp-settings-files",
									"mcp_edit_settings",
								)}
								style={{ display: "inline" }}>
								{t("mcp:learnMoreEditingSettings")}
							</VSCodeLink>
						</div>
					</>
				)}
			</Section>
		</div>
	)
}

export default McpView
