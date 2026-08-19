import * as path from "path"
import ignore from "ignore"
import { DIRS_TO_IGNORE } from "./constants"

/**
 * Context object for directory scanning operations
 */
export interface ScanContext {
	/** Whether this is the explicitly targeted directory */
	isTargetDir: boolean
	/** Whether we're inside an explicitly targeted hidden directory */
	insideExplicitHiddenTarget: boolean
	/** The base path for the scan operation */
	basePath: string
	/** The ignore instance for gitignore handling */
	ignoreInstance: ReturnType<typeof ignore>
}

/**
 * Result of computing recursion decision for a directory entry
 */
export interface RecursionDecision {
	shouldRecurse: boolean
	newContext: ScanContext
}

/**
 * Critical directories that should always be ignored, even inside explicitly targeted hidden directories
 */
const CRITICAL_IGNORE_PATTERNS = new Set(["node_modules", ".git", "__pycache__", "venv", "env"])

/**
 * Check if a directory matches any of the given patterns
 */
function matchesIgnorePattern(dirName: string, patterns: string[]): boolean {
	for (const pattern of patterns) {
		if (pattern === dirName || (pattern.includes("/") && pattern.split("/")[0] === dirName)) {
			return true
		}
	}
	return false
}

/**
 * Check if a directory is ignored by gitignore
 */
function isIgnoredByGitignore(
	fullDirPath: string,
	basePath: string,
	ignoreInstance: ReturnType<typeof ignore>,
): boolean {
	const relativePath = path.relative(basePath, fullDirPath)
	const normalizedPath = relativePath.replace(/\\/g, "/")
	return ignoreInstance.ignores(normalizedPath) || ignoreInstance.ignores(normalizedPath + "/")
}

/**
 * Check if a target directory should be included
 */
function shouldIncludeTargetDirectory(dirName: string): boolean {
	const nonHiddenIgnorePatterns = DIRS_TO_IGNORE.filter((pattern) => pattern !== ".*")
	return !matchesIgnorePattern(dirName, nonHiddenIgnorePatterns)
}

/**
 * Check if a directory inside an explicitly targeted hidden directory should be included
 */
function shouldIncludeInsideHiddenTarget(dirName: string, fullDirPath: string, context: ScanContext): boolean {
	if (CRITICAL_IGNORE_PATTERNS.has(dirName)) {
		return false
	}
	return !isIgnoredByGitignore(fullDirPath, context.basePath, context.ignoreInstance)
}

/**
 * Check if a regular directory should be included
 */
function shouldIncludeRegularDirectory(dirName: string, fullDirPath: string, context: ScanContext): boolean {
	const nonHiddenIgnorePatterns = DIRS_TO_IGNORE.filter((pattern) => pattern !== ".*")
	if (matchesIgnorePattern(dirName, nonHiddenIgnorePatterns)) {
		return false
	}
	return !isIgnoredByGitignore(fullDirPath, context.basePath, context.ignoreInstance)
}

/**
 * Determine if a directory should be included in results based on filters
 */
function shouldIncludeDirectory(dirName: string, fullDirPath: string, context: ScanContext): boolean {
	if (context.isTargetDir) {
		return shouldIncludeTargetDirectory(dirName)
	}
	if (context.insideExplicitHiddenTarget) {
		return shouldIncludeInsideHiddenTarget(dirName, fullDirPath, context)
	}
	return shouldIncludeRegularDirectory(dirName, fullDirPath, context)
}

/**
 * Check if a directory is in our explicit ignore list
 */
function isDirectoryExplicitlyIgnored(dirName: string): boolean {
	for (const pattern of DIRS_TO_IGNORE) {
		if (pattern === dirName) {
			return true
		}
		if (pattern === ".*") {
			continue
		}
		if (pattern.includes("/")) {
			const pathParts = pattern.split("/")
			if (pathParts[0] === dirName) {
				return true
			}
		}
	}
	return false
}

/**
 * Compute whether to recurse into a directory and what context to use
 */
function computeRecursionDecision(
	dirName: string,
	isHiddenDir: boolean,
	context: ScanContext,
	recursive: boolean,
): RecursionDecision | null {
	let shouldRecurseIntoDir = true
	if (context.insideExplicitHiddenTarget) {
		shouldRecurseIntoDir = !CRITICAL_IGNORE_PATTERNS.has(dirName)
	} else {
		shouldRecurseIntoDir = !isDirectoryExplicitlyIgnored(dirName)
	}

	const shouldRecurse =
		recursive &&
		shouldRecurseIntoDir &&
		!(isHiddenDir && DIRS_TO_IGNORE.includes(".*") && !context.isTargetDir && !context.insideExplicitHiddenTarget)

	if (!shouldRecurse) {
		return null
	}

	const newInsideExplicitHiddenTarget = context.insideExplicitHiddenTarget || (isHiddenDir && context.isTargetDir)

	return {
		shouldRecurse,
		newContext: {
			...context,
			isTargetDir: false,
			insideExplicitHiddenTarget: newInsideExplicitHiddenTarget,
		},
	}
}

export {
	CRITICAL_IGNORE_PATTERNS,
	computeRecursionDecision,
	isDirectoryExplicitlyIgnored,
	isIgnoredByGitignore,
	matchesIgnorePattern,
	shouldIncludeDirectory,
	shouldIncludeInsideHiddenTarget,
	shouldIncludeRegularDirectory,
	shouldIncludeTargetDirectory,
}
