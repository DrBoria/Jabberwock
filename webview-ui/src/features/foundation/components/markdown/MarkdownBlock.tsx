import React, { memo, useMemo } from "react"
import ReactMarkdown from "react-markdown"
import { visit } from "unist-util-visit"
import type { Node } from "unist"
import rehypeKatex from "rehype-katex"
import remarkMath from "remark-math"
import remarkGfm from "remark-gfm"
import { rootStore } from "@src/features/store"
import CodeBlock from "../code/CodeBlock"
import MermaidBlock from "../mermaid/MermaidBlock"
import { StyledMarkdown } from "./styles"

const MarkdownBlock = memo(({ markdown }: { markdown?: string }) => {
	const components = useMemo(
		() => ({
			table: ({ children }: { children?: React.ReactNode }) => (
				<div className="table-wrapper">
					<table>{children}</table>
				</div>
			),
			a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
				const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
					if (!href) return
					const isLocalPath = href.startsWith("file://") || href.startsWith("/") || !href.includes("://")
					if (!isLocalPath) return
					e.preventDefault()
					let filePath = href.replace("file://", "")
					const match = filePath.match(/(.*):(\d+)(-\d+)?$/)
					let values = undefined
					if (match) {
						filePath = match[1]
						values = { line: parseInt(match[2]) }
					}
					if (!filePath.startsWith("/") && !filePath.startsWith("./")) filePath = "./" + filePath
					rootStore.settings.openFile(filePath, values)
				}
				return (
					<a href={href} onClick={handleClick}>
						{children}
					</a>
				)
			},
			pre: ({ children }: { children?: React.ReactNode }) => {
				const codeEl = children as React.ReactElement
				if (!codeEl || !codeEl.props) return <pre>{children}</pre>
				const { className = "", children: codeChildren } = codeEl.props
				let codeString = ""
				if (typeof codeChildren === "string") {
					codeString = codeChildren
				} else if (Array.isArray(codeChildren)) {
					codeString = codeChildren.filter((child) => typeof child === "string").join("")
				}
				if (className.includes("language-mermaid"))
					return (
						<div style={{ margin: "1em 0" }}>
							<MermaidBlock code={codeString} />
						</div>
					)
				const match = /language-(\w+)/.exec(className)
				return (
					<div style={{ margin: "1em 0" }}>
						<CodeBlock source={codeString} language={match ? match[1] : "text"} />
					</div>
				)
			},
			code: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
				<code className={className}>{children}</code>
			),
		}),
		[],
	)

	return (
		<StyledMarkdown>
			<ReactMarkdown
				remarkPlugins={[
					remarkGfm,
					remarkMath,
					() => (tree: Node) => {
						visit(tree, "code", (node: { lang?: string }) => {
							if (!node.lang) {
								node.lang = "text"
							} else if (node.lang.includes(".")) {
								node.lang = node.lang.split(".").slice(-1)[0]
							}
						})
					},
				]}
				rehypePlugins={[rehypeKatex] as import("unified").PluggableList}
				components={components}>
				{markdown || ""}
			</ReactMarkdown>
		</StyledMarkdown>
	)
})

export default MarkdownBlock
