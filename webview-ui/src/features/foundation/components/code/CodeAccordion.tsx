import { memo, useMemo, type ReactNode } from "react"
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react"
import { type ToolProgressStatus } from "@jabberwock/types"
import { getLanguageFromPath } from "@src/utils/helpers/getLanguageFromPath"
import { formatPathTooltip } from "@src/utils/format/formatPathTooltip"

import { ToolUseBlock, ToolUseBlockHeader } from "./ToolUseBlock"
import CodeBlock from "./CodeBlock"
import { PathTooltip } from "@src/shared/ui/tooltips/PathTooltip"
import DiffView from "../diff/DiffView"

interface CodeAccordionProps {
	path?: string
	code?: string
	language: string
	progressStatus?: ToolProgressStatus
	isLoading?: boolean
	isExpanded: boolean
	isFeedback?: boolean
	onToggleExpand: () => void
	header?: string
	onJumpToFile?: () => void
	diffStats?: { added: number; removed: number }
}

function AccordionHeaderContent({
	header,
	isFeedback,
	path,
}: {
	header?: string
	isFeedback?: boolean
	path?: string
}): ReactNode {
	if (header) {
		return (
			<div className="flex items-center">
				<span className="codicon codicon-server mr-1.5"></span>
				<PathTooltip content={header}>
					<span className="whitespace-nowrap overflow-hidden text-ellipsis mr-2">{header}</span>
				</PathTooltip>
			</div>
		)
	}
	if (isFeedback) {
		return (
			<div className="flex items-center">
				<span className="codicon codicon-feedback mr-1.5" />
				<span className="whitespace-nowrap overflow-hidden text-ellipsis mr-2 rtl">User Edits</span>
			</div>
		)
	}
	return (
		<>
			{path?.startsWith(".") && <span>.</span>}
			<PathTooltip content={formatPathTooltip(path)}>
				<span className="whitespace-nowrap overflow-hidden text-ellipsis text-left mr-2 rtl">
					{formatPathTooltip(path)}
				</span>
			</PathTooltip>
		</>
	)
}

function AccordionStats({
	diffStats,
	progressStatus,
}: {
	diffStats?: { added: number; removed: number } | null
	progressStatus?: ToolProgressStatus
}): ReactNode {
	if (diffStats) {
		return (
			<div className="flex items-center gap-2 mr-1">
				<span className="text-xs font-medium text-vscode-charts-green">+{diffStats.added}</span>
				<span className="text-xs font-medium text-vscode-charts-red">-{diffStats.removed}</span>
			</div>
		)
	}
	if (progressStatus?.text) {
		return (
			<>
				{progressStatus.icon && <span className={`codicon codicon-${progressStatus.icon} mr-1`} />}
				<span className="mr-1 ml-auto text-vscode-descriptionForeground">{progressStatus.text}</span>
			</>
		)
	}
	return null
}

function AccordionActionIcons({
	onJumpToFile,
	path,
	isExpanded,
}: {
	onJumpToFile?: () => void
	path?: string
	isExpanded: boolean
}): ReactNode {
	if (onJumpToFile && path) {
		return (
			<span
				className="codicon codicon-link-external mr-1"
				style={{ fontSize: 13.5 }}
				onClick={(e: React.MouseEvent<HTMLSpanElement>) => {
					e.stopPropagation()
					onJumpToFile()
				}}
				aria-label={`Open file: ${path}`}
			/>
		)
	}
	return (
		<span className={`opacity-0 group-hover:opacity-100 codicon codicon-chevron-${isExpanded ? "up" : "down"}`} />
	)
}

function AccordionContent({
	visible,
	inferredLanguage,
	source,
	path,
}: {
	visible: boolean
	inferredLanguage: string
	source: string
	path?: string
}): ReactNode {
	if (!visible) return null
	return (
		<div className="overflow-x-auto overflow-y-auto max-h-[300px] max-w-full">
			{inferredLanguage === "diff" ? (
				<DiffView source={source} filePath={path} />
			) : (
				<CodeBlock source={source} language={inferredLanguage} />
			)}
		</div>
	)
}

const CodeAccordion = ({
	path,
	code = "",
	language,
	progressStatus,
	isLoading,
	isExpanded,
	isFeedback,
	onToggleExpand,
	header,
	onJumpToFile,
	diffStats,
}: CodeAccordionProps) => {
	const inferredLanguage = useMemo(() => language ?? (path ? getLanguageFromPath(path) : "txt"), [path, language])
	const source = useMemo(() => code.trim(), [code])
	const hasHeader = Boolean(path || isFeedback || header)

	const derivedStats = useMemo(() => {
		if (diffStats && (diffStats.added > 0 || diffStats.removed > 0)) return diffStats
		return null
	}, [diffStats])

	return (
		<ToolUseBlock>
			{hasHeader && (
				<ToolUseBlockHeader onClick={onToggleExpand} className="group">
					{isLoading && <VSCodeProgressRing className="size-3 mr-2" />}
					<AccordionHeaderContent header={header} isFeedback={isFeedback} path={path} />
					<div className="flex-grow-1" />
					<AccordionStats diffStats={derivedStats} progressStatus={progressStatus} />
					<AccordionActionIcons onJumpToFile={onJumpToFile} path={path} isExpanded={isExpanded} />
				</ToolUseBlockHeader>
			)}
			<AccordionContent
				visible={!hasHeader || isExpanded}
				inferredLanguage={inferredLanguage}
				source={source}
				path={path}
			/>
		</ToolUseBlock>
	)
}

export default memo(CodeAccordion)
