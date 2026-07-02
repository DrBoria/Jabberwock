import { memo, useMemo } from "react"
import { parseUnifiedDiff } from "@src/utils/parser/parseUnifiedDiff"
import { normalizeLanguage } from "@src/utils/text/highlighter-engine"
import { getLanguageFromPath } from "@src/utils/helpers/getLanguageFromPath"
import { buildHunks } from "./diffView.utils"
import { GapRow, DiffRow } from "./DiffRow"
import { useDiffHighlight } from "./useDiffHighlight"

interface DiffViewProps {
	source: string
	filePath?: string
}

/**
 * DiffView component renders unified diffs with side-by-side line numbers
 * matching VSCode's diff editor style
 */
const DiffView = memo(({ source, filePath }: DiffViewProps) => {
	const normalizedLang = useMemo(() => normalizeLanguage(getLanguageFromPath(filePath || "") || "txt"), [filePath])

	const isLightTheme = useMemo(
		() =>
			typeof document !== "undefined" &&
			/\bvscode-light\b|\bvscode-high-contrast-light\b/i.test(document.body.className),
		[],
	)

	const shouldHighlight = useMemo(() => source.split("\n").length <= 1000, [source])

	const diffLines = useMemo(() => parseUnifiedDiff(source, filePath), [source, filePath])

	const hunks = useMemo(() => buildHunks(diffLines), [diffLines])

	const processedHunks = useDiffHighlight(hunks, shouldHighlight, normalizedLang, isLightTheme, filePath)

	return (
		<div className="diff-view bg-[var(--vscode-editor-background)] rounded-md overflow-hidden text-[0.95em]">
			<div className="overflow-x-hidden">
				<table className="w-full border-collapse table-auto">
					<tbody>
						{processedHunks.flatMap((hunk, hunkIndex) =>
							hunk.lines.map((line, lineIndex) => {
								const globalIndex = `${hunkIndex}-${lineIndex}`
								if (line.type === "gap")
									return <GapRow key={globalIndex} hiddenCount={line.hiddenCount} />
								return (
									<DiffRow
										key={globalIndex}
										line={line}
										hunk={hunk}
										lineIndex={lineIndex}
										shouldHighlight={shouldHighlight}
									/>
								)
							}),
						)}
					</tbody>
				</table>
			</div>
		</div>
	)
})

export default DiffView
