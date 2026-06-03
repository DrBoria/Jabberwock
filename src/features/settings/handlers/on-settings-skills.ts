import { IntentType, type SkillMetadata } from "@jabberwock/types"
import type { IntentBus } from "../../intents/bus"
import * as vscode from "vscode"
import { openFile } from "../../../integrations/misc/open-file"
import { t } from "../../../i18n"
import { getSkillsManager } from "../skills/store"
import { getMstState } from "../../foundation/mst/store"
import { EventBridge } from "@features/foundation/webview/EventBridge"

type SkillSource = SkillMetadata["source"]

/**
 * Register all skills settings intent handlers.
 */

export function registerOnSettingsSkills(bus: IntentBus): void {
	// ── requestSkills ─────────────────────────────────────────────────
	bus.register(IntentType.SettingsSkillsRequest, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		try {
			const skillsManager = getSkillsManager(ctx.rootStore)
			if (skillsManager) {
				const skills = skillsManager.getSkillsMetadata()
				await provider.postMessageToWebview({ type: "skills", skills })
				getMstState(ctx.rootStore).skillsStore?.setSkills(skills)
			} else {
				await provider.postMessageToWebview({ type: "skills", skills: [] })
				getMstState(ctx.rootStore).skillsStore?.setSkills([])
			}
		} catch (error) {
			EventBridge.outputChannel?.appendLine(
				`Error fetching skills: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			await provider.postMessageToWebview({ type: "skills", skills: [] })
			getMstState(ctx.rootStore).skillsStore?.setSkills([])
		}
	})

	// ── createSkill ───────────────────────────────────────────────────
	bus.register(IntentType.SettingsSkillCreate, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as {
			skillName: string
			source: string
			skillDescription: string
			skillMode?: string
			skillModeSlugs?: string[]
		}

		try {
			const skillName = payload.skillName
			const source = payload.source as SkillSource
			const skillDescription = payload.skillDescription
			const modeSlugs = payload.skillModeSlugs ?? (payload.skillMode ? [payload.skillMode] : undefined)

			if (!skillName || !source || !skillDescription) {
				throw new Error(t("skills:errors.missing_create_fields"))
			}

			const skillsManager = getSkillsManager(ctx.rootStore)
			if (!skillsManager) {
				throw new Error(t("skills:errors.manager_unavailable"))
			}

			const createdPath = await skillsManager.createSkill(skillName, source, skillDescription, modeSlugs)

			openFile(createdPath)

			const skills = skillsManager.getSkillsMetadata()
			await provider.postMessageToWebview({ type: "skills", skills })
			getMstState(ctx.rootStore).skillsStore?.setSkills(skills)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			EventBridge.outputChannel?.appendLine(`Error creating skill: ${errorMessage}`)
			vscode.window.showErrorMessage(`Failed to create skill: ${errorMessage}`)
		}
	})

	// ── deleteSkill ───────────────────────────────────────────────────
	bus.register(IntentType.SettingsSkillDelete, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as {
			skillName: string
			source: string
			skillMode?: string
			skillModeSlugs?: string[]
		}

		try {
			const skillName = payload.skillName
			const source = payload.source as SkillSource
			const skillMode = payload.skillModeSlugs?.[0] ?? payload.skillMode

			if (!skillName || !source) {
				throw new Error(t("skills:errors.missing_delete_fields"))
			}

			const skillsManager = getSkillsManager(ctx.rootStore)
			if (!skillsManager) {
				throw new Error(t("skills:errors.manager_unavailable"))
			}

			await skillsManager.deleteSkill(skillName, source, skillMode)

			const skills = skillsManager.getSkillsMetadata()
			await provider.postMessageToWebview({ type: "skills", skills })
			getMstState(ctx.rootStore).skillsStore?.setSkills(skills)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			EventBridge.outputChannel?.appendLine(`Error deleting skill: ${errorMessage}`)
			vscode.window.showErrorMessage(`Failed to delete skill: ${errorMessage}`)
		}
	})

	// ── moveSkill ─────────────────────────────────────────────────────
	bus.register(IntentType.SettingsSkillMove, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as {
			skillName: string
			source: string
			skillMode?: string
			newSkillMode?: string
		}

		try {
			const skillName = payload.skillName
			const source = payload.source as SkillSource
			const currentMode = payload.skillMode
			const newMode = payload.newSkillMode

			if (!skillName || !source) {
				throw new Error(t("skills:errors.missing_move_fields"))
			}

			const skillsManager = getSkillsManager(ctx.rootStore)
			if (!skillsManager) {
				throw new Error(t("skills:errors.manager_unavailable"))
			}

			await skillsManager.moveSkill(skillName, source, currentMode, newMode)

			const skills = skillsManager.getSkillsMetadata()
			await provider.postMessageToWebview({ type: "skills", skills })
			getMstState(ctx.rootStore).skillsStore?.setSkills(skills)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			EventBridge.outputChannel?.appendLine(`Error moving skill: ${errorMessage}`)
			vscode.window.showErrorMessage(`Failed to move skill: ${errorMessage}`)
		}
	})

	// ── updateSkillModes ──────────────────────────────────────────────
	bus.register(IntentType.SettingsSkillModesUpdate, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as {
			skillName: string
			source: string
			newSkillModeSlugs?: string[]
		}

		try {
			const skillName = payload.skillName
			const source = payload.source as SkillSource
			const newModeSlugs = payload.newSkillModeSlugs

			if (!skillName || !source) {
				throw new Error(t("skills:errors.missing_update_modes_fields"))
			}

			const skillsManager = getSkillsManager(ctx.rootStore)
			if (!skillsManager) {
				throw new Error(t("skills:errors.manager_unavailable"))
			}

			await skillsManager.updateSkillModes(skillName, source, newModeSlugs)

			const skills = skillsManager.getSkillsMetadata()
			await provider.postMessageToWebview({ type: "skills", skills })
			getMstState(ctx.rootStore).skillsStore?.setSkills(skills)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			EventBridge.outputChannel?.appendLine(`Error updating skill modes: ${errorMessage}`)
			vscode.window.showErrorMessage(`Failed to update skill modes: ${errorMessage}`)
		}
	})

	// ── openSkillFile ─────────────────────────────────────────────────
	bus.register(IntentType.SettingsSkillFileOpen, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) return

		const payload = intent.payload as {
			skillName: string
			source: string
		}

		try {
			const skillName = payload.skillName
			const source = payload.source as SkillSource

			if (!skillName || !source) {
				throw new Error(t("skills:errors.missing_delete_fields"))
			}

			const skillsManager = getSkillsManager(ctx.rootStore)
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
			EventBridge.outputChannel?.appendLine(`Error opening skill file: ${errorMessage}`)
			vscode.window.showErrorMessage(`Failed to open skill file: ${errorMessage}`)
		}
	})
}
