import React from "react"

export const getUrlFromEnv = (env: Record<string, string>): string | null => {
	if (env.HTTP_URL) return env.HTTP_URL
	if (env.HTTP_PORT) return `http://localhost:${env.HTTP_PORT}`
	return null
}

export const getUrlFromInteractiveApp = (config: Record<string, unknown>): string | null => {
	const args = config?.args
	if (!Array.isArray(args)) return "http://localhost:3005"
	const argsStr = args.join(" ")
	const portMatch = argsStr.match(/HTTP_PORT=(\d+)/)
	if (portMatch) return `http://localhost:${portMatch[1]}`
	const urlMatch = argsStr.match(/HTTP_URL=(\S+)/)
	if (urlMatch) return urlMatch[1]
	return "http://localhost:3005"
}

export const getServerResourceUri = (server: { config: string } | undefined): string | null => {
	if (!server) return null
	try {
		const config = JSON.parse(server.config)
		const env = config?.env
		if (env) {
			const url = getUrlFromEnv(env)
			if (url) return url
		}
		if (config?.type === "interactiveApp") return getUrlFromInteractiveApp(config)
		return null
	} catch {
		return null
	}
}

export const formatRawArgs = (args: string | undefined): string => {
	try {
		return JSON.stringify(JSON.parse(args || "{}"), null, 2)
	} catch {
		return args || "{}"
	}
}

export const chevronStyle: React.CSSProperties = { transform: "rotate(0deg)", transition: "transform 0.1s" }
export const chevronActiveStyle: React.CSSProperties = { transform: "rotate(90deg)", transition: "transform 0.1s" }
export const rawToggleStyle: React.CSSProperties = {
	padding: "4px 12px",
	fontSize: "11px",
	color: "var(--vscode-descriptionForeground)",
	cursor: "pointer",
	userSelect: "none",
	display: "flex",
	alignItems: "center",
	gap: "4px",
}
export const rawToggleBorderStyle: React.CSSProperties = {
	...rawToggleStyle,
	borderBottom: "1px solid var(--vscode-widget-border, #454545)",
}
export const preStyle: React.CSSProperties = {
	margin: 0,
	padding: "8px 12px",
	fontSize: "11px",
	lineHeight: 1.4,
	backgroundColor: "var(--vscode-textCodeBlock-background)",
	color: "var(--vscode-editor-foreground)",
	overflowX: "auto",
	whiteSpace: "pre-wrap",
	wordBreak: "break-word",
	borderBottom: "1px solid var(--vscode-widget-border, #454545)",
}
