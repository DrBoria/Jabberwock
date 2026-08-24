export const CODE_BLOCK_BG_COLOR = "var(--vscode-editor-background, --vscode-sideBar-background, rgb(30 30 30))"
export const WRAPPER_ALPHA = "cc"
export const WINDOW_SHADE_SETTINGS = { transitionDelayS: 0.2, collapsedHeight: 500 }
export const SCROLL_SNAP_TOLERANCE = 20

export interface CodeBlockProps {
	source?: string
	rawSource?: string
	language: string
	preStyle?: React.CSSProperties
	initialWordWrap?: boolean
	collapsedHeight?: number
}
