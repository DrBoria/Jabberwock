import fs from "fs/promises"
import * as path from "path"
import os from "os"
import EventEmitter from "events"

import * as vscode from "vscode"

import { fileExistsAtPath } from "@utils/io/fs"
import { arePathsEqual } from "@utils/io/path"
import { t } from "@i18n"

import { CheckpointDiff, CheckpointResult, CheckpointEventMap } from "./types"
import { createSanitizedGit } from "./shadow-checkpoint-git"
import {
	writeExcludeFile,
	stageAll,
	getNestedGitRepository,
	getShadowGitConfigWorktree,
	saveCheckpoint as saveCkpt,
	restoreCheckpoint as restoreCkpt,
	getDiff as getCkptDiff,
} from "./shadow-checkpoint-operations"
import { deleteTask, deleteBranch } from "./shadow-checkpoint-statics"

export abstract class ShadowCheckpointService extends EventEmitter {
	public readonly taskId: string
	public readonly checkpointsDir: string
	public readonly workspaceDir: string

	protected _checkpoints: string[] = []
	protected _baseHash?: string

	protected readonly dotGitDir: string
	protected git?: import("simple-git").SimpleGit
	protected readonly log: (message: string) => void
	protected shadowGitConfigWorktree?: string

	public get baseHash() {
		return this._baseHash
	}

	protected set baseHash(value: string | undefined) {
		this._baseHash = value
	}

	public get isInitialized() {
		return !!this.git
	}

	public getCheckpoints(): string[] {
		return this._checkpoints.slice()
	}

	constructor(taskId: string, checkpointsDir: string, workspaceDir: string, log: (message: string) => void) {
		super()

		const homedir = os.homedir()
		const protectedPaths = [
			path.join(homedir, "Desktop"),
			path.join(homedir, "Documents"),
			path.join(homedir, "Downloads"),
			homedir,
		] as string[]

		if (protectedPaths.includes(workspaceDir)) {
			throw new Error(`Cannot use checkpoints in ${workspaceDir}`)
		}

		this.taskId = taskId
		this.checkpointsDir = checkpointsDir
		this.workspaceDir = workspaceDir
		this.dotGitDir = path.join(this.checkpointsDir, ".git")
		this.log = log
	}

	public async initShadowGit(onInit?: () => Promise<void>) {
		if (this.git) {
			throw new Error("Shadow git repo already initialized")
		}

		const nestedGitPath = await getNestedGitRepository(this.workspaceDir, this.log)

		if (nestedGitPath) {
			const relativePath = path.relative(this.workspaceDir, nestedGitPath)
			const message = t("common:errors.nested_git_repos_warning", { path: relativePath })
			vscode.window.showErrorMessage(message)
			throw new Error(
				`Checkpoints are disabled because a nested git repository was detected at: ${relativePath}. ` +
					"Please remove or relocate nested git repositories to use the checkpoints feature.",
			)
		}

		await fs.mkdir(this.checkpointsDir, { recursive: true })
		const git = createSanitizedGit(this.checkpointsDir)
		let created = false
		const startTime = Date.now()

		if (await fileExistsAtPath(this.dotGitDir)) {
			this.log(`[ShadowCheckpointService#initShadowGit] shadow git repo already exists at ${this.dotGitDir}`)
			const worktree = await getShadowGitConfigWorktree(git, this.log, this.shadowGitConfigWorktree)

			if (!worktree) {
				throw new Error("Checkpoints require core.worktree to be set in the shadow git config")
			}

			const worktreeTrimmed = worktree.trim()

			if (!arePathsEqual(worktreeTrimmed, this.workspaceDir)) {
				throw new Error(
					`Checkpoints can only be used in the original workspace: ${worktreeTrimmed} !== ${this.workspaceDir}`,
				)
			}

			await writeExcludeFile(this.dotGitDir, this.workspaceDir)
			this.baseHash = await git.revparse(["HEAD"])
		} else {
			await git.init({ "--template": "" })
			await git.addConfig("core.worktree", this.workspaceDir)
			await git.addConfig("commit.gpgSign", "false")
			await git.addConfig("user.name", "Jabberwock")
			await git.addConfig("user.email", "noreply@example.com")
			await writeExcludeFile(this.dotGitDir, this.workspaceDir)
			await stageAll(git, this.log)
			const { commit } = await git.commit("initial commit", { "--allow-empty": null })
			this.baseHash = commit
			created = true
		}

		this.git = git
		await onInit?.()
		this.emit("initialize", {
			type: "initialize",
			workspaceDir: this.workspaceDir,
			baseHash: this.baseHash,
			created,
			duration: Date.now() - startTime,
		})
	}

	public async saveCheckpoint(
		message: string,
		options?: { allowEmpty?: boolean; suppressMessage?: boolean },
	): Promise<CheckpointResult | undefined> {
		try {
			if (!this.git) {
				throw new Error("Shadow git repo not initialized")
			}
			const result = await saveCkpt(
				this.git,
				this._checkpoints,
				this._baseHash,
				message,
				options,
				(event, data) =>
					this.emit(event as keyof CheckpointEventMap, data as CheckpointEventMap[keyof CheckpointEventMap]),
				this.log,
			)
			if (result?.commit) {
				this._checkpoints.push(result.commit)
			}
			return result
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e))
			this.log(`[ShadowCheckpointService#saveCheckpoint] failed to create checkpoint: ${error.message}`)
			this.emit("error", { type: "error", error })
			throw error
		}
	}

	public async restoreCheckpoint(commitHash: string) {
		try {
			if (!this.git) {
				throw new Error("Shadow git repo not initialized")
			}
			await restoreCkpt(
				this.git,
				commitHash,
				this._checkpoints,
				(cps) => {
					this._checkpoints = cps
				},
				(event, data) =>
					this.emit(event as keyof CheckpointEventMap, data as CheckpointEventMap[keyof CheckpointEventMap]),
				this.log,
			)
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e))
			this.log(`[ShadowCheckpointService#restoreCheckpoint] failed to restore checkpoint: ${error.message}`)
			this.emit("error", { type: "error", error })
			throw error
		}
	}

	public async getDiff({ from, to }: { from?: string; to?: string }): Promise<CheckpointDiff[]> {
		if (!this.git) {
			throw new Error("Shadow git repo not initialized")
		}
		return getCkptDiff(this.git, this.workspaceDir, this.log, { from, to })
	}

	override emit<K extends keyof CheckpointEventMap>(event: K, data: CheckpointEventMap[K]) {
		return super.emit(event, data)
	}

	override on<K extends keyof CheckpointEventMap>(event: K, listener: (data: CheckpointEventMap[K]) => void) {
		return super.on(event, listener)
	}

	override off<K extends keyof CheckpointEventMap>(event: K, listener: (data: CheckpointEventMap[K]) => void) {
		return super.off(event, listener)
	}

	override once<K extends keyof CheckpointEventMap>(event: K, listener: (data: CheckpointEventMap[K]) => void) {
		return super.once(event, listener)
	}

	static deleteTask = deleteTask
	static deleteBranch = deleteBranch
}
