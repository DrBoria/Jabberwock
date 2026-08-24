import { ToolProgressStatus } from "@jabberwock/types"

import type { ToolUse, DiffStrategy, DiffResult } from "@shared/tools"

import { validateMarkerSequencing } from "./multi-search-replace-validation"
import { processReplacement } from "./multi-search-replace-replacement"

const BUFFER_LINES = 40

export class MultiSearchReplaceDiffStrategy implements DiffStrategy {
	private fuzzyThreshold: number
	private bufferLines: number

	getName(): string {
		return "MultiSearchReplace"
	}

	constructor(fuzzyThreshold?: number, bufferLines?: number) {
		this.fuzzyThreshold = fuzzyThreshold ?? 1.0
		this.bufferLines = bufferLines ?? BUFFER_LINES
	}

	async applyDiff(
		originalContent: string,
		diffContent: string,
		_paramStartLine?: number,
		_paramEndLine?: number,
	): Promise<DiffResult> {
		const validseq = validateMarkerSequencing(diffContent)
		if (!validseq.success) {
			return {
				success: false,
				error: validseq.error!,
			}
		}

		let matches = [
			...diffContent.matchAll(
				/(?:^|\n)(?<!\\)<<<<<<< SEARCH>?\s*\n((?:\:start_line:\s*(\d+)\s*\n))?((?:\:end_line:\s*(\d+)\s*\n))?((?<!\\)-------\s*\n)?([\s\S]*?)(?:\n)?(?:(?<=\n)(?<!\\)=======\s*\n)([\s\S]*?)(?:\n)?(?:(?<=\n)(?<!\\)>>>>>>> REPLACE)(?=\n|$)/g,
			),
		]

		if (matches.length === 0) {
			return {
				success: false,
				error: `Invalid diff format - missing required sections\n\nDebug Info:\n- Expected Format: <<<<<<< SEARCH\\n:start_line: start line\\n-------\\n[search content]\\n=======\\n[replace content]\\n>>>>>>> REPLACE\n- Tip: Make sure to include start_line/SEARCH/=======/REPLACE sections with correct markers on new lines`,
			}
		}

		const lineEnding = originalContent.includes("\r\n") ? "\r\n" : "\n"
		let resultLines = originalContent.split(/\r?\n/)
		let delta = 0
		let diffResults: DiffResult[] = []
		let appliedCount = 0
		const replacements = matches
			.map((match) => ({
				startLine: Number(match[2] ?? 0),
				searchContent: match[6],
				replaceContent: match[7],
			}))
			.sort((a, b) => a.startLine - b.startLine)

		for (const replacement of replacements) {
			const result = processReplacement(replacement, resultLines, delta, this.bufferLines, this.fuzzyThreshold)
			resultLines = result.resultLines
			delta = result.delta
			if (result.applied) {
				appliedCount++
			}
			if (result.diffResult) {
				diffResults.push(result.diffResult)
			}
		}

		const finalContent = resultLines.join(lineEnding)
		if (appliedCount === 0) {
			return {
				success: false,
				failParts: diffResults,
			}
		}
		return {
			success: true,
			content: finalContent,
			failParts: diffResults,
		}
	}

	getProgressStatus(toolUse: ToolUse, result?: DiffResult): ToolProgressStatus {
		const diffContent = toolUse.params.diff
		if (diffContent) {
			const icon = "diff-multiple"
			if (toolUse.partial) {
				if (Math.floor(diffContent.length / 10) % 10 === 0) {
					const searchBlockCount = (diffContent.match(/SEARCH/g) || []).length
					return { icon, text: `${searchBlockCount}` }
				}
			} else if (result) {
				const searchBlockCount = (diffContent.match(/SEARCH/g) || []).length
				if (result.failParts?.length) {
					return {
						icon,
						text: `${searchBlockCount - result.failParts.length}/${searchBlockCount}`,
					}
				} else {
					return { icon, text: `${searchBlockCount}` }
				}
			}
		}
		return {}
	}
}
