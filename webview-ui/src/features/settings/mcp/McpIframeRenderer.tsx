import React, { useEffect, useRef, useState } from "react"

interface Props {
	resourceUri: string
	agentsList: string
	inputData?: string
	onResolve?: (data: Record<string, unknown>) => void
	onCancel?: () => void
	readOnly?: boolean
}

function postContextToIframe(
	iframe: HTMLIFrameElement | null,
	agentsList: string,
	inputData: string | undefined,
	readOnly: boolean | undefined,
) {
	iframe?.contentWindow?.postMessage(
		{
			type: "mcp-context",
			data: {
				agents: agentsList,
				input: inputData,
				readOnly,
			},
		},
		"*",
	)
}

function handleMcpMessage(
	e: MessageEvent,
	agentsList: string,
	inputData: string | undefined,
	readOnly: boolean | undefined,
	onResolve: ((data: Record<string, unknown>) => void) | undefined,
	onCancel: (() => void) | undefined,
	setIsLoaded: (loaded: boolean) => void,
	iframe: HTMLIFrameElement | null,
) {
	const msgType = e.data?.type
	const msgAction = e.data?.action

	if (msgType === "mcp-context-request") {
		setIsLoaded(true)
		postContextToIframe(iframe, agentsList, inputData, readOnly)
		return
	}

	if (msgType !== "mcp-action") {
		return
	}

	if (msgAction === "accept") {
		onResolve?.(e.data.content)
	}

	if (msgAction === "cancel") {
		onCancel?.()
	}
}

export const McpIframeRenderer: React.FC<Props> = ({
	resourceUri,
	agentsList,
	inputData,
	onResolve,
	onCancel,
	readOnly,
}) => {
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const [isLoaded, setIsLoaded] = useState(false)

	useEffect(() => {
		const onMessage = (e: MessageEvent) => {
			handleMcpMessage(e, agentsList, inputData, readOnly, onResolve, onCancel, setIsLoaded, iframeRef.current)
		}
		window.addEventListener("message", onMessage)

		if (iframeRef.current) {
			iframeRef.current.onload = () => {
				setIsLoaded(true)
				postContextToIframe(iframeRef.current, agentsList, inputData, readOnly)
			}
		}

		return () => window.removeEventListener("message", onMessage)
	}, [agentsList, inputData, onResolve, onCancel, readOnly])

	return (
		<div style={{ position: "relative", width: "100%", minHeight: "400px" }}>
			{!isLoaded && (
				<div
					style={{
						position: "absolute",
						inset: 0,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: "var(--vscode-descriptionForeground)",
						fontSize: "13px",
					}}>
					Loading interactive app...
				</div>
			)}
			<iframe
				ref={iframeRef}
				src={resourceUri}
				sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
				style={{
					width: "100%",
					height: "500px",
					border: "none",
					borderRadius: "8px",
					backgroundColor: "var(--vscode-editor-background)",
				}}
			/>
		</div>
	)
}
