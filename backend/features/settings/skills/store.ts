import * as fs from "fs/promises"
import * as path from "path"
import matter from "gray-matter"
import { types, Instance } from "mobx-state-tree"

import {
	getGlobalAgentsDirectory,
	getProjectAgentsDirectoryForCwd,
	directoryExists,
	fileExists,
} from "@services/jabberwock-config/config"
import type { SkillMetadata, SkillContent } from "@shared/core/skills"
import type { IBackendRootStore } from "@features/store"
import type { EventBridge } from "@features/foundation"

// ── File I/O helpers (pure, no store state) ────────────────────────────────

function resolveModeSlugs(data: Record<string, unknown>): string[] | undefined {
	const modes = data.modes
	if (!modes) return undefined
	if (Array.isArray(modes)) return modes as string[]
	if (typeof modes === "string") return [modes]
	return undefined
}

async function loadSkillsFromDirectory(dir: string, source: "global" | "project"): Promise<SkillMetadata[]> {
	const results: SkillMetadata[] = []
	try {
		const entries = await fs.readdir(dir, { withFileTypes: true })
		for (const entry of entries) {
			if (!entry.isDirectory()) continue
			const skillMdPath = path.join(dir, entry.name, "SKILL.md")
			if (!(await fileExists(skillMdPath))) continue
			const content = await fs.readFile(skillMdPath, "utf-8")
			const data = matter(content).data as Record<string, unknown>
			results.push({
				name: entry.name,
				description: (data.description as string) || "",
				path: skillMdPath,
				source,
				mode: typeof data.mode === "string" ? (data.mode as string) : undefined,
				modeSlugs: resolveModeSlugs(data),
			})
		}
	} catch {
		// Directory may not exist or be inaccessible — no skills from it.
	}
	return results
}

async function readSkillContent(skill: SkillMetadata): Promise<SkillContent | null> {
	try {
		const content = await fs.readFile(skill.path, "utf-8")
		return { ...skill, instructions: matter(content).content }
	} catch {
		return null
	}
}

function resolveBaseDir(source: "global" | "project", cwd: string): string | undefined {
	return source === "global" ? getGlobalAgentsDirectory() : getProjectAgentsDirectoryForCwd(cwd)
}

// ── MST model ──────────────────────────────────────────────────────────────
// The skills feature owns its state here: the discovered skill metadata list,
// plus the actions that mutate it. State lives on the root store, not in a
// detached class instance.

export const SkillsModel = types
	.model("Skills", {
		skills: types.optional(types.array(types.frozen<SkillMetadata>()), []),
	})
	.actions((self) => ({
		/** (Re)discover skills from the global and project directories. */
		async initialize(cwd: string) {
			const skills: SkillMetadata[] = []
			const globalDir = getGlobalAgentsDirectory()
			if (globalDir && (await directoryExists(globalDir))) {
				skills.push(...(await loadSkillsFromDirectory(globalDir, "global")))
			}
			const projectDir = getProjectAgentsDirectoryForCwd(cwd)
			if (projectDir && (await directoryExists(projectDir))) {
				skills.push(...(await loadSkillsFromDirectory(projectDir, "project")))
			}
			self.skills.replace(skills)
		},
	}))
	.actions((self) => ({
		async updateSkillModes(
			cwd: string,
			skillName: string,
			source: "global" | "project",
			newModeSlugs?: string[],
		): Promise<void> {
			const baseDir = resolveBaseDir(source, cwd)
			if (!baseDir) throw new Error("Skills directory not available")

			const skillMdPath = path.join(baseDir, skillName, "SKILL.md")
			if (!(await fileExists(skillMdPath))) throw new Error(`Skill file not found: ${skillMdPath}`)

			const parsed = matter(await fs.readFile(skillMdPath, "utf-8"))
			const data = parsed.data as Record<string, unknown>
			if (newModeSlugs && newModeSlugs.length > 0) data.modes = newModeSlugs
			else delete data.modes

			await fs.writeFile(skillMdPath, matter.stringify(parsed.content, data), "utf-8")
			await self.initialize(cwd)
		},
	}))
	.actions((self) => ({
		async createSkill(
			cwd: string,
			skillName: string,
			source: "global" | "project",
			description: string,
			modeSlugs?: string[],
		): Promise<string> {
			const baseDir = resolveBaseDir(source, cwd)
			if (!baseDir) throw new Error("Skills directory not available")

			const skillDir = path.join(baseDir, skillName)
			await fs.mkdir(skillDir, { recursive: true })

			const frontMatter: Record<string, unknown> = { description }
			if (modeSlugs && modeSlugs.length > 0) frontMatter.modes = modeSlugs

			const skillMdPath = path.join(skillDir, "SKILL.md")
			await fs.writeFile(skillMdPath, matter.stringify(`# ${skillName}\n\n`, frontMatter), "utf-8")

			await self.initialize(cwd)
			return skillMdPath
		},

		async deleteSkill(cwd: string, skillName: string, source: "global" | "project"): Promise<void> {
			const baseDir = resolveBaseDir(source, cwd)
			if (!baseDir) throw new Error("Skills directory not available")

			const skillDir = path.join(baseDir, skillName)
			if (await directoryExists(skillDir)) {
				await fs.rm(skillDir, { recursive: true, force: true })
			}
			await self.initialize(cwd)
		},

		async moveSkill(
			cwd: string,
			skillName: string,
			source: "global" | "project",
			currentMode?: string,
			newMode?: string,
		): Promise<void> {
			const skill = self.skills.find((s) => s.name === skillName && s.source === source)
			if (!skill) throw new Error(`Skill '${skillName}' not found in ${source}`)

			const modeSlugs = [...(skill.modeSlugs || [])]
			if (currentMode) {
				const idx = modeSlugs.indexOf(currentMode)
				if (idx >= 0) {
					if (newMode) modeSlugs[idx] = newMode
					else modeSlugs.splice(idx, 1)
				} else if (newMode) {
					modeSlugs.push(newMode)
				}
			}
			await self.updateSkillModes(cwd, skillName, source, modeSlugs)
		},
	}))
	.actions((self) => ({
		getSkillsForMode(currentMode: string): SkillMetadata[] {
			return self.skills.filter((skill) => {
				if (!skill.modeSlugs || skill.modeSlugs.length === 0) {
					return !skill.mode || skill.mode === currentMode
				}
				return skill.modeSlugs.includes(currentMode)
			})
		},

		getSkillsMetadata(): SkillMetadata[] {
			return [...self.skills]
		},

		findSkillByNameAndSource(skillName: string, source: "global" | "project"): SkillMetadata | undefined {
			return self.skills.find((s) => s.name === skillName && s.source === source)
		},

		async getSkillContent(name: string, _currentMode?: string): Promise<SkillContent | null> {
			const skill = self.skills.find((s) => s.name === name)
			if (!skill) return null
			return readSkillContent(skill)
		},
	}))

export type ISkillsModel = Instance<typeof SkillsModel>

// ── Accessors ──────────────────────────────────────────────────────────────

export function initSkillsState(_provider: EventBridge): void {
	// Skills are lazily loaded via SkillsModel.initialize(cwd).
}

export function getSkillsState(rootStore: IBackendRootStore): ISkillsModel {
	return rootStore.settings.skills
}

export function getSkillsManager(rootStore: IBackendRootStore): ISkillsModel | undefined {
	return rootStore.settings.skills
}

export type { SkillMetadata, SkillContent }
