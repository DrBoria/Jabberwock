import path from "path"

import { escapeRegExp } from "@features/chat/tools/helpers/shared"
export { escapeRegExp }

import type { ITaskModel } from "@features/chat/task/store"
import type { SayToolData } from "@jabberwock/types"

import type { LineEnding, ReplacementResult, ReplacementError } from "./editFileHelpers.types"
export type { LineEnding, ReplacementError }

import {
	formatReplacementError,
	buildFileExistsError,
	buildReadFileError,
	buildFileNotFoundError,
	buildEditApprovalMessage,
} from "./editFileHelpers.errors"
export {
	formatReplacementError,
	buildFileExistsError,
	buildReadFileError,
	buildFileNotFoundError,
	buildEditApprovalMessage,
}

export function countOccurrences(str: string, substr: string): number {
	if (substr === "") return 0
	let count = 0
	let pos = str.indexOf(substr)
	while (pos !== -1) {
		count++
		pos = str.indexOf(substr, pos + substr.length)
	}
	return count
}

export function safeLiteralReplace(str: string, oldString: string, newString: string): string {
	if (oldString === "" || !str.includes(oldString)) {
		return str
	}

	if (!newString.includes("$")) {
		return str.replaceAll(oldString, newString)
	}

	const escapedNewString = newString.replaceAll("$", "$$$$")
	return str.replaceAll(oldString, escapedNewString)
}

export function detectLineEnding(content: string): LineEnding {
	return content.includes("\r\n") ? "\r\n" : "\n"
}

export function normalizeToLF(str: string): string {
	const normalized = str.replace(/\r\n/g, "\n")
	return normalized
}

export function coerceStringParam(value: unknown): string {
	if (typeof value === "string") {
		return value
	}
	if (value === null || value === undefined) {
		return ""
	}
	return String(value)
}

export function resolveRelativePath(filePath: string, cwd: string): string {
	if (path.isAbsolute(filePath)) {
		return filePath
	}
	return path.resolve(cwd, filePath)
}

export function performEditReplacement(
	currentContentLF: string,
	oldLF: string,
	newLF: string,
	expectedReplacements: number,
	allowMultiple: boolean,
	absolutePath: string,
): { success: true; contentLF: string } | { success: false; error: ReplacementError } {
	const exactOccurrences = countOccurrences(currentContentLF, oldLF)

	if (exactOccurrences === 0) {
		return {
			success: false,
			error: {
				type: "no_match",
				exactOccurrences,
				wsOccurrences: 0,
				tokenOccurrences: 0,
				expectedReplacements,
				absolutePath,
			},
		}
	}

	if (exactOccurrences !== expectedReplacements && !allowMultiple) {
		return {
			success: false,
			error: {
				type: "exact_count_mismatch",
				exactOccurrences,
				wsOccurrences: 0,
				tokenOccurrences: 0,
				expectedReplacements,
				absolutePath,
			},
		}
	}

	const contentLF = safeLiteralReplace(currentContentLF, oldLF, newLF)
	return { success: true, contentLF }
}

export function restoreLineEnding(contentLF: string, originalEol: LineEnding): string {
	if (originalEol === "\r\n") {
		return contentLF.replace(/\n/g, "\r\n")
	}
	return contentLF
}

export function resetEditFileMistakeCount(task: ITaskModel, relPath: string): void {
	const updated = { ...task.consecutiveMistakeCountForEditFile }
	delete updated[relPath]
	task.setConsecutiveMistakeCountForEditFile(updated)
}

export function buildWhitespaceTolerantRegex(str: string): string {
	const regex = str.replace(/\s+/g, "\\s+")
	return regex
}

export function buildTokenRegex(str: string): string {
	const regex = escapeRegExp(str)
	return regex
}

export function countRegexMatches(str: string, regex: RegExp): number {
	return (str.match(regex) || []).length
}
