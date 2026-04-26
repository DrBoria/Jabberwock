import React from "react"
import type { ClineMessage } from "@jabberwock/types"
import { safeJsonParse } from "@shared/core"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { getAllModes } from "@shared/modes"
import { vscode } from "@src/utils/vscode"
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
			<Container preset="header" p="0">
				{icon}
				{title || "Interactive App"}
			</Container>
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
