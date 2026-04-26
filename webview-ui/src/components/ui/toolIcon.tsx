import React from "react"

/** Shared tool icon component used across tool and say renderers */
export const toolIcon = (name: string) => (
	<span
		className={`codicon codicon-${name}`}
		style={{ color: "var(--vscode-foreground)", marginBottom: "-1.5px" }}></span>
)
