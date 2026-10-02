import * as path from "path"
import * as childProcess from "child_process"
import { getAppRoot } from "@features/foundation/capabilities"
import { getBinPath } from "@utils/ripgrep"
import { DIRS_TO_IGNORE } from "@services/glob/constants"

/**
 * Get the path to the ripgrep binary, or `undefined` when no binary is
 * available. Callers are expected to degrade gracefully (see `listFiles` in
 * `./main.ts`) instead of failing the whole task.
 */
export async function getRipgrepPath(): Promise<string | undefined> {
	// Test/override hook: an explicit JABBERWOCK_RG_PATH wins. Empty string
	// forces the "no ripgrep" fallback path in listFiles.
	const override = process.env.JABBERWOCK_RG_PATH
	if (override !== undefined) {
		return override || undefined
	}
	let vscodeAppRoot: string
	try {
		vscodeAppRoot = getAppRoot()
	} catch {
		// Capabilities not installed yet (e.g. early tests) — fall through to
		// the system ripgrep lookup, which is all we can do without an app root.
		return findSystemRipgrepPath()
	}
	const rgPath = await getBinPath(vscodeAppRoot)
	return rgPath
}

async function findSystemRipgrepPath(): Promise<string | undefined> {
	try {
		const result = childProcess.execSync("which rg", { encoding: "utf-8" }).trim()
		return result || undefined
	} catch {
		return undefined
	}
}

/**
 * Build appropriate ripgrep arguments based on whether we're doing a recursive search
 */
export function buildRipgrepArgs(dirPath: string, recursive: boolean): string[] {
	const args = ["--files", "--hidden", "--follow"]

	if (recursive) {
		return [...args, ...buildRecursiveArgs(dirPath), dirPath]
	} else {
		return [...args, ...buildNonRecursiveArgs(), dirPath]
	}
}

/**
 * Build ripgrep arguments for recursive directory traversal
 */
function buildRecursiveArgs(dirPath: string): string[] {
	const args: string[] = []

	const normalizedPath = path.normalize(dirPath)
	const pathParts = normalizedPath.split(path.sep).filter((part) => part.length > 0)
	const isTargetingHiddenDir = pathParts.some((part) => part.startsWith("."))

	const targetDirName = path.basename(dirPath)
	const isTargetInIgnoreList = DIRS_TO_IGNORE.includes(targetDirName)

	if (isTargetingHiddenDir || isTargetInIgnoreList) {
		args.push("--no-ignore-vcs")
		args.push("--no-ignore")
		args.push("-g", "*")
		args.push("-g", "**/*")
	}

	for (const dir of DIRS_TO_IGNORE) {
		if (dir === ".*") {
			if (!isTargetingHiddenDir) {
				args.push("-g", `!**/.*/**`)
			}
			continue
		}

		if (dir === targetDirName && isTargetInIgnoreList) {
			continue
		}

		args.push("-g", `!**/${dir}/**`)
	}

	return args
}

/**
 * Build ripgrep arguments for non-recursive directory listing
 */
function buildNonRecursiveArgs(): string[] {
	const args: string[] = []

	args.push("-g", "*")
	args.push("--maxdepth", "1")

	for (const dir of DIRS_TO_IGNORE) {
		if (dir === ".*") {
			continue
		} else {
			args.push("-g", `!${dir}`)
			args.push("-g", `!${dir}/**`)
		}
	}

	return args
}

/**
 * List files using ripgrep with appropriate arguments
 */
export async function listFilesWithRipgrep(
	rgPath: string,
	dirPath: string,
	recursive: boolean,
	limit: number,
): Promise<string[]> {
	const rgArgs = buildRipgrepArgs(dirPath, recursive)

	const relativePaths = await execRipgrep(rgPath, rgArgs, limit)

	const absolutePath = path.resolve(dirPath)
	return relativePaths.map((relativePath) => path.resolve(absolutePath, relativePath))
}

/**
 * Execute ripgrep command and return list of files
 */
async function execRipgrep(rgPath: string, args: string[], limit: number): Promise<string[]> {
	return new Promise((resolve, reject) => {
		const rgProcess = childProcess.spawn(rgPath, args)
		let output = ""
		let results: string[] = []

		const timeoutId = setTimeout(() => {
			rgProcess.kill()
			console.warn("[jabberwock] ripgrep timed out, returning partial results")
			resolve(results.slice(0, limit))
		}, 10_000)

		rgProcess.stdout.on("data", (data) => {
			output += data.toString()
			processRipgrepOutput()

			if (results.length >= limit) {
				rgProcess.kill()
				clearTimeout(timeoutId)
			}
		})

		rgProcess.stderr.on("data", (data) => {
			console.error(`[jabberwock] ripgrep stderr: ${data}`)
		})

		rgProcess.on("close", (code) => {
			clearTimeout(timeoutId)
			processRipgrepOutput(true)

			if (code !== 0 && code !== null && code !== 143) {
				console.warn(`[jabberwock] ripgrep process exited with code ${code}, returning partial results`)
			}

			resolve(results.slice(0, limit))
		})

		rgProcess.on("error", (error) => {
			clearTimeout(timeoutId)
			reject(new Error(`ripgrep process error: ${error.message}`))
		})

		function processRipgrepOutput(isFinal = false) {
			const lines = output.split("\n")

			if (!isFinal) {
				output = lines.pop() || ""
			} else {
				output = ""
			}

			for (const line of lines) {
				if (line.trim() && results.length < limit) {
					results.push(line)
				} else if (results.length >= limit) {
					break
				}
			}
		}
	})
}
