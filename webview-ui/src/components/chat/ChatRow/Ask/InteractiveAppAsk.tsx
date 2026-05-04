import React from "react"
import type { ClineMessage } from "@jabberwock/types"
import { safeJsonParse } from "@shared/core"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { getAllModes } from "@shared/modes"
import { vscode } from "@jabberwock/devtool/react"
import { McpIframeRenderer } from "../../../../features/mcp-apps/McpIframeRenderer"
import { Container } from "@src/components/ui"

interface InteractiveAppAskProps {
	message: ClineMessage
	icon: React.ReactNode
	title: React.ReactNode
	t: (key: string, options?: any) => string
}

export const InteractiveAppAsk: React.FC<InteractiveAppAskProps> = ({ message, icon, title, t: _t }) => {
	const { customModes } = useExtensionState()
	const uiMeta = safeJsonParse<any>(message.text, {})
	const [showRawArgs, setShowRawArgs] = React.useState(false)

	if (!uiMeta || !uiMeta.resourceUri) {
		return <div className="p-4 text-vscode-errorForeground">Invalid interactive app metadata</div>
	}

	const allowedContextData = {
		agents: getAllModes(customModes)
			.map((m: any) => ({ slug: m.slug, name: m.name }))
			.filter(Boolean),
	}

	return (
		<>
			<Container $preset="header" $p="0">
				{icon}
				{title || "Interactive App"}
			</Container>
			<div
				style={{
					fontSize: "12px",
					color: "var(--vscode-textLink-foreground)",
					cursor: "pointer",
					padding: "4px 12px",
					display: "inline-flex",
					alignItems: "center",
					userSelect: "none",
				}}
				onClick={() => setShowRawArgs(!showRawArgs)}>
				<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: 4 }}>
					{showRawArgs ? <path d="M4 8h8L8 4z" /> : <path d="M6 4v8l4-4z" />}
				</svg>
				Raw agent arguments
			</div>
			{showRawArgs && (
				<pre
					style={{
						fontSize: "11px",
						background: "var(--vscode-textBlockQuote-background)",
						padding: "8px",
						borderRadius: "4px",
						overflow: "auto",
						maxHeight: "300px",
						margin: "0 12px 8px",
						whiteSpace: "pre-wrap",
						wordBreak: "break-word",
					}}>
					{(() => {
						try {
							return JSON.stringify(uiMeta.input || {}, null, 2)
						} catch {
							return String(uiMeta.input || "")
						}
					})()}
				</pre>
			)}
			<div className="mt-2">
				<McpIframeRenderer
					resourceUri={uiMeta.resourceUri}
					agentsList={JSON.stringify(allowedContextData.agents)}
					inputData={uiMeta.input ? JSON.stringify(uiMeta.input) : undefined}
					onResolve={(data: any) => {
						vscode.postMessage({
							type: "askResponse",
							askResponse: "yesButtonClicked",
							text: JSON.stringify(data),
						})
					}}
					onCancel={() => {
						vscode.postMessage({
							type: "askResponse",
							askResponse: "messageResponse",
							text: "Cancel",
						})
					}}
				/>
			</div>
		</>
	)
}
