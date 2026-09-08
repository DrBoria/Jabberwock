import * as childProcess from "child_process"
import * as path from "path"
import * as readline from "readline"

import { getAppRoot } from "@features/foundation/capabilities/registry"
import { VirtualWorkspace } from "@features/foundation/time-machine/VirtualWorkspace"

import { fileExistsAtPath } from "@utils/io/fs"
import { truncateLine } from "./utils"
import { parseAndFormatResults } from "./parser"

const isWindows = process.platform.startsWith("win")
const binName = isWindows ? "rg.exe" : "rg"

const MAX_RESULTS = 300

export { truncateLine }

/**
 * Get the path to the ripgrep binary within the VSCode installation
 */
export async function getBinPath(vscodeAppRoot: string): Promise<string | undefined> {
	const virtualWorkspace = new VirtualWorkspace()
	const checkPath = async (pkgFolder: string) => {
		const fullPath = path.join(vscodeAppRoot, pkgFolder, binName)
		return (await fileExistsAtPath(fullPath, virtualWorkspace)) ? fullPath : undefined
	}

	return (
		(await checkPath("node_modules/@vscode/ripgrep/bin/")) ||
		(await checkPath("node_modules/vscode-ripgrep/bin")) ||
		(await checkPath("node_modules.asar.unpacked/vscode-ripgrep/bin/")) ||
		(await checkPath("node_modules.asar.unpacked/@vscode/ripgrep/bin/")) ||
		(await findSystemRipgrep())
	)
}

async function findSystemRipgrep(): Promise<string | undefined> {
	try {
		const result = childProcess.execSync("which rg", { encoding: "utf-8" }).trim()
		if (result) {
			return result
		}
	} catch {}

	return undefined
}

async function execRipgrep(bin: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const rgProcess = childProcess.spawn(bin, args)
		const rl = readline.createInterface({
			input: rgProcess.stdout,
			crlfDelay: Infinity,
		})

		let output = ""
		let lineCount = 0
		const maxLines = MAX_RESULTS * 5

		rl.on("line", (line) => {
			if (lineCount < maxLines) {
				output += line + "\n"
				lineCount++
			} else {
				rl.close()
				rgProcess.kill()
			}
		})

		let errorOutput = ""
		rgProcess.stderr.on("data", (data) => {
			errorOutput += data.toString()
		})
		rl.on("close", () => {
			if (errorOutput) {
				reject(new Error(`ripgrep process error: ${errorOutput}`))
			} else {
				resolve(output)
			}
		})
		rgProcess.on("error", (error) => {
			reject(new Error(`ripgrep process error: ${error.message}`))
		})
	})
}

export async function regexSearchFiles(
	cwd: string,
	directoryPath: string,
	regex: string,
	filePattern?: string,
	ignorePatterns?: string,
): Promise<string> {
	const vscodeAppRoot = getAppRoot()
	const rgPath = await getBinPath(vscodeAppRoot)

	if (!rgPath) {
		throw new Error("Could not find ripgrep binary")
	}

	const args = ["--json", "-e", regex]

	if (filePattern) {
		args.push("--glob", filePattern)
	}

	args.push("--context", "1", "--no-messages", directoryPath)

	let output: string
	try {
		output = await execRipgrep(rgPath, args)
	} catch (error) {
		console.error("[jabberwock] Error executing ripgrep:", error)
		return "No results found"
	}

	return parseAndFormatResults(output, ignorePatterns, cwd)
}
