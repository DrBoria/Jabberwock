import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import matter from "gray-matter"

import type { EventBridge } from "@features/foundation/webview/EventBridge"
import {
	getGlobalRooDirectory,
	getGlobalAgentsDirectory,
	getProjectAgentsDirectoryForCwd,
} from "@services/jabberwock-config"
import { directoryExists, fileExists } from "@services/jabberwock-config"
import { SkillMetadata, SkillContent } from "@shared/skills"
import { modes, getAllModes } from "@shared/modes"
import {
	validateSkillName as validateSkillNameShared,
	SkillNameValidationError,
	SKILL_NAME_MAX_LENGTH,
} from "@jabberwock/types"
import { getBackendRootStore } from "@features/storeSingleton"
import { getWorkspacePath } from "@utils/io/path"

export class SkillsManager {
	private skills: SkillMetadata[] = []

	constructor() {}

	async initialize(cwd: string): Promise<void> {
		const skills: SkillMetadata[] = []

		// Load global skills
		const globalDir = getGlobalAgentsDirectory()
		if (globalDir && (await directoryExists(globalDir))) {
			const globalSkills = await this.loadSkillsFromDirectory(globalDir, "global")
			skills.push(...globalSkills)
		}

		// Load project skills
		const projectDir = getProjectAgentsDirectoryForCwd(cwd)
		if (projectDir && (await directoryExists(projectDir))) {
			const projectSkills = await this.loadSkillsFromDirectory(projectDir, "project")
			skills.push(...projectSkills)
		}

		this.skills = skills
	}

	private async loadSkillsFromDirectory(dir: string, source: "global" | "project"): Promise<SkillMetadata[]> {
		const results: SkillMetadata[] = []
		try {
			const entries = await fs.readdir(dir, { withFileTypes: true })
			for (const entry of entries) {
				if (entry.isDirectory()) {
					const skillDir = path.join(dir, entry.name)
					const skillMdPath = path.join(skillDir, "SKILL.md")
					if (await fileExists(skillMdPath)) {
						const content = await fs.readFile(skillMdPath, "utf-8")
						const parsed = matter(content)
						const data = parsed.data as Record<string, unknown>
						const modeSlugs = data.modes
							? Array.isArray(data.modes)
								? (data.modes as string[])
								: typeof data.modes === "string"
									? [data.modes as string]
									: undefined
							: undefined
						results.push({
							name: entry.name,
							description: (data.description as string) || "",
							path: skillMdPath,
							source,
							mode: typeof data.mode === "string" ? (data.mode as string) : undefined,
							modeSlugs,
						})
					}
				}
			}
		} catch {
			// Directory may not exist or be accessible
		}
		return results
	}

	getSkillsForMode(currentMode: string): SkillMetadata[] {
		return this.skills.filter((skill) => {
			if (!skill.modeSlugs || skill.modeSlugs.length === 0) {
				return !skill.mode || skill.mode === currentMode
			}
			return skill.modeSlugs.includes(currentMode)
		})
	}

	getSkillsMetadata(): SkillMetadata[] {
		return [...this.skills]
	}

	async getSkillContent(name: string, currentMode?: string): Promise<SkillContent | null> {
		const skill = this.skills.find((s) => s.name === name)
		if (!skill) return null

		try {
			const content = await fs.readFile(skill.path, "utf-8")
			const parsed = matter(content)
			return {
				...skill,
				instructions: parsed.content,
			}
		} catch {
			return null
		}
	}

	async createSkill(
		skillName: string,
		source: "global" | "project",
		description: string,
		modeSlugs?: string[],
	): Promise<string> {
		const baseDir =
			source === "global" ? getGlobalAgentsDirectory() : getProjectAgentsDirectoryForCwd(this.getCwd())
		if (!baseDir) {
			throw new Error("Skills directory not available")
		}

		const skillDir = path.join(baseDir, skillName)
		await fs.mkdir(skillDir, { recursive: true })

		const frontMatter: Record<string, unknown> = {
			description,
		}
		if (modeSlugs && modeSlugs.length > 0) {
			frontMatter.modes = modeSlugs
		}

		const skillContent = matter.stringify("# " + skillName + "\n\n", frontMatter)
		const skillMdPath = path.join(skillDir, "SKILL.md")
		await fs.writeFile(skillMdPath, skillContent, "utf-8")

		// Reload skills
		await this.initialize(this.getCwd())

		return skillMdPath
	}

	async deleteSkill(skillName: string, source: "global" | "project", skillMode?: string): Promise<void> {
		const baseDir =
			source === "global" ? getGlobalAgentsDirectory() : getProjectAgentsDirectoryForCwd(this.getCwd())
		if (!baseDir) {
			throw new Error("Skills directory not available")
		}

		const skillDir = path.join(baseDir, skillName)
		if (await directoryExists(skillDir)) {
			await fs.rm(skillDir, { recursive: true, force: true })
		}

		// Reload skills
		await this.initialize(this.getCwd())
	}

	async moveSkill(
		skillName: string,
		source: "global" | "project",
		currentMode?: string,
		newMode?: string,
	): Promise<void> {
		const skill = this.skills.find((s) => s.name === skillName && s.source === source)
		if (!skill) {
			throw new Error(`Skill '${skillName}' not found in ${source}`)
		}

		const modeSlugs = [...((skill.modeSlugs as string[]) || [])]
		if (currentMode) {
			const idx = modeSlugs.indexOf(currentMode)
			if (idx >= 0) {
				if (newMode) {
					modeSlugs[idx] = newMode
				} else {
					modeSlugs.splice(idx, 1)
				}
			} else if (newMode) {
				modeSlugs.push(newMode)
			}
		}

		await this.updateSkillModes(skillName, source, modeSlugs)
	}

	async updateSkillModes(skillName: string, source: "global" | "project", newModeSlugs?: string[]): Promise<void> {
		const baseDir =
			source === "global" ? getGlobalAgentsDirectory() : getProjectAgentsDirectoryForCwd(this.getCwd())
		if (!baseDir) {
			throw new Error("Skills directory not available")
		}

		const skillDir = path.join(baseDir, skillName)
		const skillMdPath = path.join(skillDir, "SKILL.md")

		if (!(await fileExists(skillMdPath))) {
			throw new Error(`Skill file not found: ${skillMdPath}`)
		}

		const content = await fs.readFile(skillMdPath, "utf-8")
		const parsed = matter(content)
		const data = parsed.data as Record<string, unknown>

		if (newModeSlugs && newModeSlugs.length > 0) {
			data.modes = newModeSlugs
		} else {
			delete data.modes
		}

		const newContent = matter.stringify(parsed.content, data)
		await fs.writeFile(skillMdPath, newContent, "utf-8")

		// Reload skills
		await this.initialize(this.getCwd())
	}

	findSkillByNameAndSource(skillName: string, source: "global" | "project"): SkillMetadata | undefined {
		return this.skills.find((s) => s.name === skillName && s.source === source)
	}

	private getCwd(): string {
		const rootStore = getBackendRootStore()
		return rootStore?.chat?.activeTask?.cwd ?? ""
	}
}
