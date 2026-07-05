import fs from "fs/promises"
import * as path from "path"

import { SimpleGit } from "simple-git"

import { executeRipgrep } from "@services/search/file-search"

import { CheckpointDiff, CheckpointResult } from "./types"
import { getExcludePatterns } from "./excludes"

export async function writeExcludeFile(dotGitDir: string, workspaceDir: string) {
	await fs.mkdir(path.join(dotGitDir, "info"), { recursive: true })
	const patterns = await getExcludePatterns(workspaceDir)
	await fs.writeFile(path.join(dotGitDir, "info", "exclude"), patterns.join("\n"))
}

export async function stageAll(git: SimpleGit, log: (message: string) => void) {
	try {
		await git.add([".", "--ignore-errors"])
	} catch (error) {
		log(`[stageAll] failed to add files to git: ${error instanceof Error ? error.message : String(error)}`)
	}
}

export async function getNestedGitRepository(
	workspaceDir: string,
	log: (message: string) => void,
): Promise<string | null> {
	try {
		const args = ["--files", "--hidden", "--follow", "-g", "**/.git/HEAD", workspaceDir]
		const gitPaths = await executeRipgrep({ args, workspacePath: workspaceDir })
		const nestedGitPaths = gitPaths.filter(({ type, path: filePath }) => {
			if (type !== "file") return false
			const normalizedPath = filePath.replace(/\\/g, "/")
			return (
				normalizedPath.includes(".git/HEAD") &&
				!normalizedPath.startsWith(".git/") &&
				normalizedPath !== ".git/HEAD"
			)
		})
		if (nestedGitPaths.length > 0) {
			const headPath = nestedGitPaths[0].path
			const gitDir = path.dirname(headPath)
			const repoDir = path.dirname(gitDir)
			const absolutePath = path.join(workspaceDir, repoDir)
			log(`[getNestedGitRepository] found ${nestedGitPaths.length} nested git repositories, first at: ${repoDir}`)
			return absolutePath
		}
		return null
	} catch (error) {
		log(
			`[getNestedGitRepository] failed to check for nested git repos: ${error instanceof Error ? error.message : String(error)}`,
		)
		return null
	}
}

export async function getShadowGitConfigWorktree(
	git: SimpleGit,
	log: (message: string) => void,
	cached?: string,
): Promise<string | undefined> {
	if (cached !== undefined) return cached
	try {
		return (await git.getConfig("core.worktree")).value || undefined
	} catch (error) {
		log(
			`[getShadowGitConfigWorktree] failed to get core.worktree: ${error instanceof Error ? error.message : String(error)}`,
		)
		return undefined
	}
}

export function handleSaveCheckpointResult(
	result: { commit?: string },
	fromHash: string,
	toHash: string,
	duration: number,
	emit: (event: string, data: unknown) => boolean,
	log: (message: string) => void,
	options?: { suppressMessage?: boolean },
): CheckpointResult | undefined {
	if (!result.commit) {
		log(`[saveCheckpoint] found no changes to commit in ${duration}ms`)
		return undefined
	}
	emit("checkpoint", {
		type: "checkpoint",
		fromHash,
		toHash,
		duration,
		suppressMessage: options?.suppressMessage ?? false,
	})
	log(`[saveCheckpoint] checkpoint saved in ${duration}ms -> ${result.commit}`)
	return result as CheckpointResult
}

export async function saveCheckpoint(
	git: SimpleGit,
	checkpoints: string[],
	baseHash: string | undefined,
	message: string,
	options: { allowEmpty?: boolean; suppressMessage?: boolean } | undefined,
	emit: (event: string, data: unknown) => boolean,
	log: (message: string) => void,
): Promise<CheckpointResult | undefined> {
	log(`[saveCheckpoint] starting checkpoint save (allowEmpty: ${options?.allowEmpty ?? false})`)
	const startTime = Date.now()
	await stageAll(git, log)
	const commitArgs = options?.allowEmpty ? { "--allow-empty": null } : undefined
	const result = await git.commit(message, commitArgs)
	const fromHash = checkpoints[checkpoints.length - 1] ?? baseHash!
	const toHash = result.commit || fromHash
	const duration = Date.now() - startTime
	return handleSaveCheckpointResult(result, fromHash, toHash, duration, emit, log, options)
}

export async function restoreCheckpoint(
	git: SimpleGit,
	commitHash: string,
	checkpoints: string[],
	setCheckpoints: (cps: string[]) => void,
	emit: (event: string, data: unknown) => boolean,
	log: (message: string) => void,
) {
	log(`[restoreCheckpoint] starting checkpoint restore`)
	const start = Date.now()
	await git.clean("f", ["-d", "-f"])
	await git.reset(["--hard", commitHash])
	const checkpointIndex = checkpoints.indexOf(commitHash)
	if (checkpointIndex !== -1) {
		setCheckpoints(checkpoints.slice(0, checkpointIndex + 1))
	}
	const duration = Date.now() - start
	emit("restore", { type: "restore", commitHash, duration })
	log(`[restoreCheckpoint] restored checkpoint ${commitHash} in ${duration}ms`)
}

export async function getDiff(
	git: SimpleGit,
	workspaceDir: string,
	log: (message: string) => void,
	{ from, to }: { from?: string; to?: string },
): Promise<CheckpointDiff[]> {
	const result: CheckpointDiff[] = []
	if (!from) {
		from = (await git.raw(["rev-list", "--max-parents=0", "HEAD"])).trim()
	}
	await stageAll(git, log)
	log(`[getDiff] diffing ${to ? `${from}..${to}` : `${from}..HEAD`}`)
	const { files } = to ? await git.diffSummary([`${from}..${to}`]) : await git.diffSummary([from])
	const cwdPath = (await getShadowGitConfigWorktree(git, log)) || workspaceDir || ""
	for (const file of files) {
		const relPath = file.file
		const absPath = path.join(cwdPath, relPath)
		const before = await git.show([`${from}:${relPath}`]).catch(() => "")
		const after = to
			? await git.show([`${to}:${relPath}`]).catch(() => "")
			: await fs.readFile(absPath, "utf8").catch(() => "")
		result.push({ paths: { relative: relPath, absolute: absPath }, content: { before, after } })
	}
	return result
}
