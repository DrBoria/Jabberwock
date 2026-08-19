import { useEffect, useRef, useState } from "react"
import mermaid from "mermaid"
import styled from "styled-components"
import { useDebounceEffect } from "@/features/settings/agents/mode-selector/utils/useDebounceEffect"
import { rootStore } from "@src/features/store"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useCopyToClipboard } from "@sections/dndTextArea/utils/clipboard/clipboard"
import CodeBlock from "../code/CodeBlock"
import { MermaidButton } from "./MermaidButton"
import { MERMAID_THEME, svgToPng } from "./utils"

mermaid.initialize({
	startOnLoad: false,
	securityLevel: "loose",
	theme: "dark",
	suppressErrorRendering: true,
	themeVariables: {
		...MERMAID_THEME,
		fontSize: "16px",
		fontFamily: "var(--vscode-font-family, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif)",
		noteTextColor: "#ffffff",
		noteBkgColor: "#454545",
		noteBorderColor: "#888888",
		critBorderColor: "#ff9580",
		critBkgColor: "#803d36",
		taskTextColor: "#ffffff",
		taskTextOutsideColor: "#ffffff",
		taskTextLightColor: "#ffffff",
		sectionBkgColor: "#2d2d2d",
		sectionBkgColor2: "#3c3c3c",
		altBackground: "#2d2d2d",
		linkColor: "#6cb6ff",
		compositeBackground: "#2d2d2d",
		compositeBorder: "#888888",
		titleColor: "#ffffff",
	},
})

export default function MermaidBlock({ code }: { code: string }) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [isErrorExpanded, setIsErrorExpanded] = useState(false)
	const { showCopyFeedback, copyWithFeedback } = useCopyToClipboard()
	const { t } = useAppTranslation()

	useEffect(() => {
		setIsLoading(true)
		setError(null)
	}, [code])

	useDebounceEffect(
		() => {
			if (containerRef.current) containerRef.current.innerHTML = ""
			mermaid
				.parse(code)
				.then(() => {
					const id = `mermaid-${Math.random().toString(36).substring(2)}`
					return mermaid.render(id, code)
				})
				.then(({ svg }) => {
					if (containerRef.current) containerRef.current.innerHTML = svg
				})
				.catch((err) => {
					console.warn("[jabberwock] Mermaid parse/render failed:", err)
					setError(err.message || "Failed to render Mermaid diagram")
				})
				.finally(() => setIsLoading(false))
		},
		500,
		[code],
	)

	const handleClick = async () => {
		if (!containerRef.current) return
		const svgEl = containerRef.current.querySelector("svg")
		if (!svgEl) return
		try {
			const pngDataUrl = await svgToPng(svgEl)
			rootStore.settings.openImage(pngDataUrl)
		} catch (err) {
			console.error("[jabberwock] Error converting SVG to PNG:", err)
		}
	}

	return (
		<MermaidBlockContainer>
			{isLoading && <LoadingMessage>{t("common:mermaid.loading")}</LoadingMessage>}
			{error ? (
				<div style={{ marginTop: "0px", overflow: "hidden", marginBottom: "8px" }}>
					<div
						style={{
							borderBottom: isErrorExpanded ? "1px solid var(--vscode-editorGroup-border)" : "none",
							fontWeight: "normal",
							fontSize: "var(--vscode-font-size)",
							color: "var(--vscode-editor-foreground)",
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							cursor: "pointer",
						}}
						onClick={() => setIsErrorExpanded(!isErrorExpanded)}>
						<div style={{ display: "flex", alignItems: "center", gap: "10px", flexGrow: 1 }}>
							<span
								className="codicon codicon-warning"
								style={{
									color: "var(--vscode-editorWarning-foreground)",
									opacity: 0.8,
									fontSize: 16,
									marginBottom: "-1.5px",
								}}></span>
							<span style={{ fontWeight: "bold" }}>{t("common:mermaid.render_error")}</span>
						</div>
						<div style={{ display: "flex", alignItems: "center" }}>
							<CopyButton
								onClick={(e) => {
									e.stopPropagation()
									const combinedContent = `Error: ${error}\n\n\`\`\`mermaid\n${code}\n\`\`\``
									copyWithFeedback(combinedContent, e)
								}}>
								<span className={`codicon codicon-${showCopyFeedback ? "check" : "copy"}`}></span>
							</CopyButton>
							<span className={`codicon codicon-chevron-${isErrorExpanded ? "up" : "down"}`}></span>
						</div>
					</div>
					{isErrorExpanded && (
						<div
							style={{
								padding: "8px",
								backgroundColor: "var(--vscode-editor-background)",
								borderTop: "none",
							}}>
							<div style={{ marginBottom: "8px", color: "var(--vscode-descriptionForeground)" }}>
								{error}
							</div>
							<CodeBlock language="mermaid" source={code} />
						</div>
					)}
				</div>
			) : (
				<MermaidButton containerRef={containerRef} code={code} isLoading={isLoading} svgToPng={svgToPng}>
					<SvgContainer onClick={handleClick} ref={containerRef} $isLoading={isLoading}></SvgContainer>
				</MermaidButton>
			)}
		</MermaidBlockContainer>
	)
}

const MermaidBlockContainer = styled.div`
	position: relative;
	margin: 8px 0;
`

const LoadingMessage = styled.div`
	padding: 8px 0;
	color: var(--vscode-descriptionForeground);
	font-style: italic;
	font-size: 0.9em;
`

const CopyButton = styled.button`
	padding: 3px;
	height: 24px;
	margin-right: 4px;
	color: var(--vscode-editor-foreground);
	display: flex;
	align-items: center;
	justify-content: center;
	background: transparent;
	border: none;
	cursor: pointer;
	&:hover {
		opacity: 0.8;
	}
`

const SvgContainer = styled.div<{ $isLoading: boolean }>`
	opacity: ${(props) => (props.$isLoading ? 0.3 : 1)};
	min-height: 20px;
	transition: opacity 0.2s ease;
	cursor: pointer;
	display: flex;
	justify-content: center;
	max-height: 400px;
	& > svg {
		display: block;
		width: 100%;
		max-height: 100%;
	}
`
