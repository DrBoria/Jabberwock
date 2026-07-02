import React from "react"
import type { McpServer } from "@jabberwock/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/shared/ui/buttons/button"

export const NetworkTimeoutSelector = ({
	timeoutValue,
	onTimeoutChange,
}: {
	timeoutValue: number
	onTimeoutChange: (event: React.ChangeEvent<HTMLSelectElement>) => void
}) => {
	const { t } = useAppTranslation()
	const timeoutOptions = [
		{ value: 15, label: t("mcp:networkTimeout.options.15seconds") },
		{ value: 30, label: t("mcp:networkTimeout.options.30seconds") },
		{ value: 60, label: t("mcp:networkTimeout.options.1minute") },
		{ value: 300, label: t("mcp:networkTimeout.options.5minutes") },
		{ value: 600, label: t("mcp:networkTimeout.options.10minutes") },
		{ value: 900, label: t("mcp:networkTimeout.options.15minutes") },
		{ value: 1800, label: t("mcp:networkTimeout.options.30minutes") },
		{ value: 3600, label: t("mcp:networkTimeout.options.60minutes") },
	]
	return (
		<div style={{ padding: "10px 7px" }}>
			<div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
				<span>{t("mcp:networkTimeout.label")}</span>
				<select
					value={timeoutValue}
					onChange={onTimeoutChange}
					style={{
						flex: 1,
						padding: "4px",
						background: "var(--vscode-dropdown-background)",
						color: "var(--vscode-dropdown-foreground)",
						border: "1px solid var(--vscode-dropdown-border)",
						borderRadius: "2px",
						outline: "none",
						cursor: "pointer",
					}}>
					{timeoutOptions.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>
			</div>
			<span style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)", display: "block" }}>
				{t("mcp:networkTimeout.description")}
			</span>
		</div>
	)
}

export const ServerErrorSection = ({ server, onRestart }: { server: McpServer; onRestart: () => void }) => {
	const { t } = useAppTranslation()
	if (server.disabled) return null
	return (
		<div
			style={{
				fontSize: "13px",
				background: "var(--vscode-textCodeBlock-background)",
				borderRadius: "0 0 4px 4px",
				width: "100%",
			}}>
			<div
				style={{
					color: "var(--vscode-testing-iconFailed)",
					marginBottom: "8px",
					padding: "0 10px",
					overflowWrap: "break-word",
					wordBreak: "break-word",
				}}>
				{server.error?.split("\n").map((item, index) => (
					<React.Fragment key={index}>
						{index > 0 && <br />}
						{item}
					</React.Fragment>
				))}
			</div>
			<Button
				variant="secondary"
				onClick={onRestart}
				disabled={server.status === "connecting"}
				style={{ width: "calc(100% - 20px)", margin: "0 10px 10px 10px" }}>
				{server.status === "connecting"
					? t("mcp:serverStatus.retrying")
					: t("mcp:serverStatus.retryConnection")}
			</Button>
		</div>
	)
}
