import { memo } from "react"
import styled from "styled-components"
import { CODE_BLOCK_BG_COLOR, WRAPPER_ALPHA, WINDOW_SHADE_SETTINGS } from "./CodeBlock.constants"

export const CodeBlockButton = styled.button`
	background: transparent;
	border: none;
	color: var(--vscode-foreground);
	cursor: var(--copy-button-cursor, default);
	padding: 4px;
	margin: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	opacity: 0.4;
	border-radius: 3px;
	pointer-events: var(--copy-button-events, none);
	margin-left: 4px;
	height: 24px;
	width: 24px;
	&:hover {
		background: var(--vscode-toolbar-hoverBackground);
		opacity: 1;
	}
	svg {
		display: block;
	}
`

export const CodeBlockButtonWrapper = styled.div`position:fixed;top:var(--copy-button-top);right:var(--copy-button-right,8px);height:auto;z-index:40;background:${CODE_BLOCK_BG_COLOR}${WRAPPER_ALPHA};overflow:visible;pointer-events:none;opacity:var(--copy-button-opacity,0);padding:4px 6px;border-radius:3px;display:inline-flex;align-items:center;justify-content:center;&:hover{background:var(--vscode-editor-background);opacity:1!important}${CodeBlockButton}{position:relative;top:0;right:0}}`

export const CodeBlockContainer = styled.div`position:relative;overflow:hidden;background-color:${CODE_BLOCK_BG_COLOR};${CodeBlockButtonWrapper}{opacity:0;pointer-events:none;transition:opacity .2s}&[data-partially-visible="true"]:hover ${CodeBlockButtonWrapper}{opacity:1;pointer-events:all;cursor:pointer}}`

export const StyledPre = styled.div<{
	preStyle?: React.CSSProperties
	wordwrap?: string
	windowshade?: string
	collapsedHeight?: number
}>`
	background-color: ${CODE_BLOCK_BG_COLOR};
	max-height: ${({ windowshade, collapsedHeight }) =>
		windowshade === "true" ? `${collapsedHeight || WINDOW_SHADE_SETTINGS.collapsedHeight}px` : "none"};
	overflow-y: auto;
	padding: 8px 3px;
	border-radius: 6px;
	${({ preStyle }) => preStyle && { ...preStyle }}pre {
		background-color: ${CODE_BLOCK_BG_COLOR};
		border-radius: 5px;
		margin: 0;
		padding: 10px;
		width: 100%;
		box-sizing: border-box;
	}
	pre,
	code {
		white-space: ${({ wordwrap }) => (wordwrap === "false" ? "pre" : "pre-wrap")};
		word-break: ${({ wordwrap }) => (wordwrap === "false" ? "normal" : "normal")};
		overflow-wrap: ${({ wordwrap }) => (wordwrap === "false" ? "normal" : "break-word")};
		font-size: 0.95em;
		font-family: var(--vscode-editor-font-family);
	}
	pre > code {
		.hljs-deletion {
			background-color: var(--vscode-diffEditor-removedTextBackground);
			display: inline-block;
			width: 100%;
		}
		.hljs-addition {
			background-color: var(--vscode-diffEditor-insertedTextBackground);
			display: inline-block;
			width: 100%;
		}
	}
	.hljs {
		color: var(--vscode-editor-foreground, #fff);
		background-color: ${CODE_BLOCK_BG_COLOR};
	}
`

export const getCSSPadding = (cs: CSSStyleDeclaration) => {
	const p = parseInt(cs.getPropertyValue("padding") || "0", 10)
	return p > 0 ? p : parseInt(cs.getPropertyValue("padding-top") || "0", 10)
}

export const getWrapperHeight = (w: HTMLDivElement | null) => {
	if (!w) return 0
	const r = w.getBoundingClientRect()
	if (r.height > 0) return r.height
	const c = w.children.item(0)
	if (!c) return 0
	const br = c.getBoundingClientRect(),
		bs = window.getComputedStyle(c),
		pt = parseInt(bs.getPropertyValue("padding-top") || "0", 10),
		pb = parseInt(bs.getPropertyValue("padding-bottom") || "0", 10)
	return br.height + pt + pb
}

export const MemoizedCodeContent = memo(({ children }: { children: React.ReactNode }) => <>{children}</>)

interface MemoizedStyledPreProps {
	preRef: React.RefObject<HTMLDivElement | null>
	preStyle?: React.CSSProperties
	wordWrap: boolean
	windowShade: boolean
	collapsedHeight?: number
	highlightedCode: React.ReactNode
	updateCodeBlockButtonPosition: (forceHide?: boolean) => void
}

export const MemoizedStyledPre = memo(
	({
		preRef,
		preStyle,
		wordWrap,
		windowShade,
		collapsedHeight,
		highlightedCode,
		updateCodeBlockButtonPosition,
	}: MemoizedStyledPreProps) => (
		<StyledPre
			ref={preRef as React.Ref<HTMLDivElement>}
			preStyle={preStyle}
			wordwrap={wordWrap ? "true" : "false"}
			windowshade={windowShade ? "true" : "false"}
			collapsedHeight={collapsedHeight}
			onMouseDown={() => updateCodeBlockButtonPosition(true)}
			onMouseUp={() => updateCodeBlockButtonPosition(false)}>
			<MemoizedCodeContent>{highlightedCode}</MemoizedCodeContent>
		</StyledPre>
	),
)
