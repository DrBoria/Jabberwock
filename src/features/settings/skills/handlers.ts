import * as vscode from "vscode"

import type { EventBridge } from "../../../core/webview/EventBridge"
import type { SkillMetadata, WebviewMessage } from "@jabberwock/types"

import { openFile } from "../../../integrations/misc/open-file"
import { t } from "../../../i18n"
import { getSkillsManager } from "./store"
import { getMstState } from "../../foundation/mst/store"

type SkillSource = SkillMetadata["source"]

export type HandlerFn = (provider: EventBridge, message: WebviewMessage) => Promise<void>

export const handlerMap: Record<string, HandlerFn> = {
	requestSkills: async (provider, _message) => {
		try {
			const skillsManager = getSkillsManager(provider)
			if (skillsManager) {
				const skills = skillsManager.getSkillsMetadata()
				await provider.postMessageToWebview({ type: "skills", skills })
				// Dual-write: MST store
				getMstState(provider).skillsStore?.setSkills(skills)
			} else {
				await provider.postMessageToWebview({ type: "skills", skills: [] })
				// Dual-write: MST store
				getMstState(provider).skillsStore?.setSkills([])
			}
		} catch (error) {
			provider.log(`Error fetching skills: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
			await provider.postMessageToWebview({ type: "skills", skills: [] })
			// Dual-write: MST store
			getMstState(provider).skillsStore?.setSkills([])
		}
	},

	createSkill: async (provider, message) => {
		try {
			const skillName = message.skillName
			const source = message.source as SkillSource
			const skillDescription = message.skillDescription
			// Support new modeSlugs array or fall back to legacy skillMode
			const modeSlugs = message.skillModeSlugs ?? (message.skillMode ? [message.skillMode] : undefined)

			if (!skillName || !source || !skillDescription) {
				throw new Error(t("skills:errors.missing_create_fields"))
			}

			const skillsManager = getSkillsManager(provider)
			if (!skillsManager) {
				throw new Error(t("skills:errors.manager_unavailable"))
			}

			const createdPath = await skillsManager.createSkill(skillName, source, skillDescription, modeSlugs)

			// Open the created file in the editor
			openFile(createdPath)

			// Send updated skills list
			const skills = skillsManager.getSkillsMetadata()
			await provider.postMessageToWebview({ type: "skills", skills })
			// Dual-write: MST store
			getMstState(provider).skillsStore?.setSkills(skills)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			provider.log(`Error creating skill: ${errorMessage}`)
			vscode.window.showErrorMessage(`Failed to create skill: ${errorMessage}`)
		}
	},

	deleteSkill: async (provider, message) => {
		try {
			const skillName = message.skillName
			const source = message.source as SkillSource
			// Support new skillModeSlugs array or fall back to legacy skillMode
			const skillMode = message.skillModeSlugs?.[0] ?? message.skillMode

			if (!skillName || !source) {
				throw new Error(t("skills:errors.missing_delete_fields"))
			}

			const skillsManager = getSkillsManager(provider)
			if (!skillsManager) {
				throw new Error(t("skills:errors.manager_unavailable"))
			}

			await skillsManager.deleteSkill(skillName, source, skillMode)

			// Send updated skills list
			const skills = skillsManager.getSkillsMetadata()
			await provider.postMessageToWebview({ type: "skills", skills })
			getMstState(provider).skillsStore?.setSkills(skills)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			provider.log(`Error deleting skill: ${errorMessage}`)
			vscode.window.showErrorMessage(`Failed to delete skill: ${errorMessage}`)
		}
	},

	moveSkill: async (provider, message) => {
		try {
			const skillName = message.skillName
			const source = message.source as SkillSource
			const currentMode = message.skillMode
			const newMode = message.newSkillMode

			if (!skillName || !source) {
				throw new Error(t("skills:errors.missing_move_fields"))
			}

			const skillsManager = getSkillsManager(provider)
			if (!skillsManager) {
				throw new Error(t("skills:errors.manager_unavailable"))
			}

			await skillsManager.moveSkill(skillName, source, currentMode, newMode)

			// Send updated skills list
			const skills = skillsManager.getSkillsMetadata()
			await provider.postMessageToWebview({ type: "skills", skills })
			getMstState(provider).skillsStore?.setSkills(skills)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			provider.log(`Error moving skill: ${errorMessage}`)
			vscode.window.showErrorMessage(`Failed to move skill: ${errorMessage}`)
		}
	},

	updateSkillModes: async (provider, message) => {
		try {
			const skillName = message.skillName
			const source = message.source as SkillSource
			const newModeSlugs = message.newSkillModeSlugs

			if (!skillName || !source) {
				throw new Error(t("skills:errors.missing_update_modes_fields"))
			}

			const skillsManager = getSkillsManager(provider)
			if (!skillsManager) {
				throw new Error(t("skills:errors.manager_unavailable"))
			}

			await skillsManager.updateSkillModes(skillName, source, newModeSlugs)

			// Send updated skills list
			const skills = skillsManager.getSkillsMetadata()
			await provider.postMessageToWebview({ type: "skills", skills })
			getMstState(provider).skillsStore?.setSkills(skills)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			provider.log(`Error updating skill modes: ${errorMessage}`)
			vscode.window.showErrorMessage(`Failed to update skill modes: ${errorMessage}`)
		}
	},

	openSkillFile: async (provider, message) => {
		try {
			const skillName = message.skillName
			const source = message.source as SkillSource

			if (!skillName || !source) {
				throw new Error(t("skills:errors.missing_delete_fields"))
			}

			const skillsManager = getSkillsManager(provider)
			if (!skillsManager) {
				throw new Error(t("skills:errors.manager_unavailable"))
			}

			// Find skill by name and source (skills may have modeSlugs arrays now)
			const skill = skillsManager.findSkillByNameAndSource(skillName, source)
			if (!skill) {
				throw new Error(t("skills:errors.skill_not_found", { name: skillName }))
			}

			openFile(skill.path)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			provider.log(`Error opening skill file: ${errorMessage}`)
			vscode.window.showErrorMessage(`Failed to open skill file: ${errorMessage}`)
		}
	},
}

// Standalone export wrappers (used by tests)
export async function handleRequestSkills(provider: EventBridge): Promise<SkillMetadata[]> {
	const handler = handlerMap.requestSkills
	await handler(provider, {} as WebviewMessage)
	const skillsManager = getSkillsManager(provider)
	if (skillsManager) {
		return skillsManager.getSkillsMetadata()
	}
	return []
}

export async function handleCreateSkill(
	provider: EventBridge,
	message: WebviewMessage,
): Promise<SkillMetadata[] | undefined> {
	try {
		const skillName = message.skillName
		const source = message.source as SkillSource
		const skillDescription = message.skillDescription

		if (!skillName || !source || !skillDescription) {
			throw new Error(t("skills:errors.missing_create_fields"))
		}

		const skillsManager = getSkillsManager(provider)
		if (!skillsManager) {
			throw new Error(t("skills:errors.manager_unavailable"))
		}

		const modeSlugs = message.skillModeSlugs ?? (message.skillMode ? [message.skillMode] : undefined)
		const createdPath = await skillsManager.createSkill(skillName, source, skillDescription, modeSlugs)
		openFile(createdPath)

		const skills = skillsManager.getSkillsMetadata()
		await provider.postMessageToWebview({ type: "skills", skills })
		getMstState(provider).skillsStore?.setSkills(skills)
		return skills
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		provider.log(`Error creating skill: ${errorMessage}`)
		vscode.window.showErrorMessage(`Failed to create skill: ${errorMessage}`)
		return undefined
	}
}

export async function handleDeleteSkill(
	provider: EventBridge,
	message: WebviewMessage,
): Promise<SkillMetadata[] | undefined> {
	try {
		const skillName = message.skillName
		const source = message.source as SkillSource

		if (!skillName || !source) {
			throw new Error(t("skills:errors.missing_delete_fields"))
		}

		const skillsManager = getSkillsManager(provider)
		if (!skillsManager) {
			throw new Error(t("skills:errors.manager_unavailable"))
		}

		const skillMode = message.skillModeSlugs?.[0] ?? message.skillMode
		await skillsManager.deleteSkill(skillName, source, skillMode)

		const skills = skillsManager.getSkillsMetadata()
		await provider.postMessageToWebview({ type: "skills", skills })
		getMstState(provider).skillsStore?.setSkills(skills)
		return skills
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		provider.log(`Error deleting skill: ${errorMessage}`)
		vscode.window.showErrorMessage(`Failed to delete skill: ${errorMessage}`)
		return undefined
	}
}

export async function handleMoveSkill(
	provider: EventBridge,
	message: WebviewMessage,
): Promise<SkillMetadata[] | undefined> {
	try {
		const skillName = message.skillName
		const source = message.source as SkillSource

		if (!skillName || !source) {
			throw new Error(t("skills:errors.missing_move_fields"))
		}

		const skillsManager = getSkillsManager(provider)
		if (!skillsManager) {
			throw new Error(t("skills:errors.manager_unavailable"))
		}

		const currentMode = message.skillMode
		const newMode = message.newSkillMode
		await skillsManager.moveSkill(skillName, source, currentMode, newMode)

		const skills = skillsManager.getSkillsMetadata()
		await provider.postMessageToWebview({ type: "skills", skills })
		getMstState(provider).skillsStore?.setSkills(skills)
		return skills
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		provider.log(`Error moving skill: ${errorMessage}`)
		vscode.window.showErrorMessage(`Failed to move skill: ${errorMessage}`)
		return undefined
	}
}

export async function handleOpenSkillFile(provider: EventBridge, message: WebviewMessage): Promise<void> {
	try {
		const skillName = message.skillName
		const source = message.source as SkillSource

		if (!skillName || !source) {
			throw new Error(t("skills:errors.missing_delete_fields"))
		}

		const skillsManager = getSkillsManager(provider)
		if (!skillsManager) {
			throw new Error(t("skills:errors.manager_unavailable"))
		}

		const skill = skillsManager.findSkillByNameAndSource(skillName, source)
		if (!skill) {
			throw new Error(t("skills:errors.skill_not_found", { name: skillName }))
		}

		openFile(skill.path)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		provider.log(`Error opening skill file: ${errorMessage}`)
		vscode.window.showErrorMessage(`Failed to open skill file: ${errorMessage}`)
	}
}
