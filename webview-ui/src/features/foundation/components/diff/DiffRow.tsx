import type { DiffLine } from "@src/utils/parser/parseUnifiedDiff"
import type { Hunk } from "./diffView.utils"
import { getHighlightOrFallback } from "./diffView.utils"

const renderContent = (
	line: DiffLine,
	hunk: Hunk,
	lineIndexInHunk: number,
	shouldHighlight: boolean,
): React.ReactNode => {
	if (!shouldHighlight || !hunk.highlightedOldLines || !hunk.highlightedNewLines) {
		return line.content
	}

	const hunkLinesBeforeThis = hunk.lines.slice(0, lineIndexInHunk).filter((l) => l.type !== "gap")

	if (line.type === "deletion") {
		const oldLineIndex = hunkLinesBeforeThis.filter((l) => l.type === "deletion" || l.type === "context").length
		return getHighlightOrFallback(hunk.highlightedOldLines[oldLineIndex], line.content)
	}

	if (line.type === "addition") {
		const newLineIndex = hunkLinesBeforeThis.filter((l) => l.type === "addition" || l.type === "context").length
		return getHighlightOrFallback(hunk.highlightedNewLines[newLineIndex], line.content)
	}

	if (line.type === "context") {
		const newLineIndex = hunkLinesBeforeThis.filter((l) => l.type === "addition" || l.type === "context").length
		const oldLineIndex = hunkLinesBeforeThis.filter((l) => l.type === "deletion" || l.type === "context").length
		return getHighlightOrFallback(
			hunk.highlightedNewLines[newLineIndex],
			getHighlightOrFallback(hunk.highlightedOldLines[oldLineIndex], line.content),
		)
	}

	return line.content
}

export const GapRow = ({ hiddenCount }: { hiddenCount?: number }) => (
	<tr>
		<td className="w-[45px] text-right pr-3 pl-2 select-none align-top whitespace-nowrap bg-[var(--vscode-editor-background)]" />
		<td className="w-[45px] text-right pr-3 select-none align-top whitespace-nowrap bg-[var(--vscode-editor-background)]" />
		<td className="w-[12px] align-top bg-[var(--vscode-editor-background)]" />
		<td className="w-[16px] text-center select-none bg-[var(--vscode-editor-background)]" />
		<td className="pr-3 whitespace-pre-wrap break-words w-full italic bg-[var(--vscode-editor-background)]">
			{`${hiddenCount ?? 0} hidden lines`}
		</td>
	</tr>
)

interface DiffRowProps {
	line: DiffLine
	hunk: Hunk
	lineIndex: number
	shouldHighlight: boolean
}

export const DiffRow = ({ line, hunk, lineIndex, shouldHighlight }: DiffRowProps) => {
	const gutterBgClass =
		line.type === "addition"
			? "bg-[var(--vscode-diffEditor-insertedTextBackground)]"
			: line.type === "deletion"
				? "bg-[var(--vscode-diffEditor-removedTextBackground)]"
				: "bg-[var(--vscode-editorGroup-border)]"

	const contentBgClass =
		line.type === "addition"
			? "diff-content-inserted"
			: line.type === "deletion"
				? "diff-content-removed"
				: "diff-content-context"

	const sign = line.type === "addition" ? "+" : line.type === "deletion" ? "-" : ""

	return (
		<tr>
			<td className={`w-[45px] text-right pr-1 pl-1 select-none align-top whitespace-nowrap ${gutterBgClass}`}>
				{line.oldLineNum || ""}
			</td>
			<td className={`w-[45px] text-right pr-1 select-none align-top whitespace-nowrap ${gutterBgClass}`}>
				{line.newLineNum || ""}
			</td>
			<td className={`w-[12px] ${gutterBgClass} align-top`} />
			<td className={`w-[16px] text-center select-none whitespace-nowrap px-1 ${gutterBgClass}`}>{sign}</td>
			<td className={`pl-1 pr-3 whitespace-pre-wrap break-words w-full ${contentBgClass}`}>
				{renderContent(line, hunk, lineIndex, shouldHighlight)}
			</td>
		</tr>
	)
}
