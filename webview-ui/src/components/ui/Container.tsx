import React from "react"
import styled, { css } from "styled-components"

/* ─── Theme variants ─── */

export type ContainerTheme = "default" | "card" | "overlay" | "dialog" | "subtle"

const themeStyles: Record<ContainerTheme, ReturnType<typeof css>> = {
	default: css`
		background: transparent;
		color: var(--vscode-editor-foreground);
	`,
	card: css`
		background: var(--vscode-editor-background);
		border: 1px solid var(--vscode-editorGroup-border);
		border-radius: 4px;
		color: var(--vscode-editor-foreground);
	`,
	overlay: css`
		background: var(--vscode-editor-background);
		border: 1px solid var(--vscode-editorWidget-border);
		border-radius: 6px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		color: var(--vscode-editor-foreground);
	`,
	dialog: css`
		background: var(--vscode-editor-background);
		border: 1px solid var(--vscode-editorWidget-border);
		border-radius: 8px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
		padding: 16px;
		color: var(--vscode-editor-foreground);
	`,
	subtle: css`
		background: var(--vscode-editor-background);
		border: 1px solid var(--vscode-editorGroup-border);
		border-radius: 3px;
		color: var(--vscode-descriptionForeground);
		font-size: calc(var(--vscode-font-size) - 1px);
	`,
}

/* ─── Grid presets ─── */

export type GridPreset =
	| "row" // single row: items in a line
	| "row-reverse" // single row, right-aligned
	| "col" // single column
	| "header" // icon + title + right slot
	| "header-cost" // icon + title + cost badge
	| "toolbar" // icon + title + expand toggle
	| "two-col" // two equal columns
	| "auto" // auto-flow columns

const gridPresets: Record<GridPreset, ReturnType<typeof css>> = {
	row: css`
		display: grid;
		grid-template-columns: 1fr;
		grid-auto-flow: column;
		align-items: center;
		gap: 8px;
	`,
	"row-reverse": css`
		display: grid;
		grid-template-columns: 1fr;
		grid-auto-flow: column;
		align-items: center;
		justify-items: end;
		gap: 8px;
	`,
	col: css`
		display: grid;
		grid-template-columns: 1fr;
		grid-auto-flow: row;
		gap: 4px;
	`,
	header: css`
		display: grid;
		grid-template-columns: auto 1fr auto;
		grid-template-rows: 1fr;
		align-items: center;
		gap: 8px;
	`,
	"header-cost": css`
		display: grid;
		grid-template-columns: auto 1fr auto;
		grid-template-rows: 1fr;
		align-items: center;
		gap: 10px;
	`,
	toolbar: css`
		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-rows: 1fr;
		align-items: center;
		gap: 8px;
	`,
	"two-col": css`
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	`,
	auto: css`
		display: grid;
		grid-template-columns: 1fr;
		gap: 8px;
	`,
}

/* ─── Props ─── */

export interface ContainerProps {
	theme?: ContainerTheme
	preset?: GridPreset
	/** CSS grid-template-columns value, e.g. "1fr 20px" or "repeat(3, 1fr)" */
	templates?: string
	/** Custom grid-template-columns override (alias for templates) */
	columns?: string
	/** Custom grid-template-rows override */
	rows?: string
	/** CSS gap value, e.g. "4px" or "0.5rem" */
	gap?: string
	/** CSS align-items value */
	align?: string
	ml?: string // margin-left
	mt?: string // margin-top
	mb?: string // margin-bottom
	p?: string // padding
	w?: string // width
	as?: keyof JSX.IntrinsicElements
	children?: React.ReactNode
	className?: string
	onClick?: (e: React.MouseEvent) => void
	style?: React.CSSProperties
	title?: string
}

/* ─── Styled component ─── */

const ContainerRoot = styled.div<ContainerProps>`
	${({ theme }) => themeStyles[(theme as ContainerTheme) || "default"]};
	${({ preset }) => preset && gridPresets[preset as GridPreset]};
	${({ templates }) => templates && `grid-template-columns: ${templates};`};
	${({ columns }) => columns && `grid-template-columns: ${columns};`};
	${({ rows }) => rows && `grid-template-rows: ${rows};`};
	${({ gap }) => gap && `gap: ${gap};`};
	${({ align }) => align && `align-items: ${align};`};
	${({ ml }) => ml && `margin-left: ${ml};`};
	${({ mt }) => mt && `margin-top: ${mt};`};
	${({ mb }) => mb && `margin-bottom: ${mb};`};
	${({ p }) => p && `padding: ${p};`};
	${({ w }) => w && `width: ${w};`};
`

/**
 * Container — a CSS Grid-based layout component with theme variants.
 *
 * Themes: "default" | "card" | "overlay" | "dialog" | "subtle"
 * Grid presets: "row" | "row-reverse" | "col" | "header" | "header-cost" | "toolbar" | "two-col" | "auto"
 *
 * Examples:
 *   <Container preset="header" theme="card" p="8px 12px">
 *     <Icon /><span>Title</span><button>Action</button>
 *   </Container>
 *
 *   <Container preset="col" ml="24px" gap="2px">
 *     <div>item 1</div>
 *     <div>item 2</div>
 *   </Container>
 *
 *   <Container templates="1fr 20px" gap="4px" align="center">
 *     <span>Content</span>
 *     <button>X</button>
 *   </Container>
 */
export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
	({ children, className, onClick, style, title, ...rest }, ref) => (
		<ContainerRoot ref={ref} {...rest} className={className} onClick={onClick} style={style} title={title}>
			{children}
		</ContainerRoot>
	),
)
Container.displayName = "Container"
