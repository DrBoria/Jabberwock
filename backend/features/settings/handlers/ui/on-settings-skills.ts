import { IntentType, type SkillMetadata } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import { openFile } from "@integrations/misc/open-file"
import { t } from "@i18n"
import { getSkillsManager } from "@features/settings/skills/store"
import { getMstState } from "@features/foundation/mst/store"
import type { IBackendRootStore } from "@features/store"
import { log as backendLog } from "@features/foundation/capabilities/backend-logger"

type SkillSource = SkillMetadata["source"]

/**
 * Register all skills settings intent handlers.
 */

/** Validate that required skill fields are present */
function requireSkillFields(skillName: string, source: string, description?: string): void {
	if (!skillName || !source) {
		throw new Error(t("skills:errors.missing_delete_fields"))
	}
	if (description !== undefined && !description) {
		throw new Error(t("skills:errors.missing_create_fields"))
	}
}

/** Get the skills manager or throw if unavailable */
function requireSkillsManager(rootStore: IBackendRootStore): import("@features/settings/skills/store").SkillsManager {
	const manager = getSkillsManager(rootStore)
	if (!manager) {
		throw new Error(t("skills:errors.manager_unavailable"))
	}
	return manager
}

/** Send updated skills list to webview and MST store */
async function postSkillsUpdate(
	provider: import("@jabberwock/types").WebviewProvider,
	rootStore: IBackendRootStore,
	skills: import("@jabberwock/types").SkillMetadata[],
): Promise<void> {
	await provider.postMessageToWebview({ type: "skills", skills })
	getMstState(rootStore).skillsStore?.setSkills(skills)
}

export function registerOnSettingsSkills(bus: IntentBus): void {
	// ── requestSkills ─────────────────────────────────────────────────
	bus.register(IntentType.SettingsSkillsRequest, async (_intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}

		try {
			const skillsManager = getSkillsManager(ctx.rootStore)
			if (skillsManager) {
				const skills = skillsManager.getSkillsMetadata()
				await postSkillsUpdate(provider, ctx.rootStore, skills)
			} else {
				await postSkillsUpdate(provider, ctx.rootStore, [])
			}
		} catch (error) {
			backendLog.info(
				`Error fetching skills: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)}`,
			)
			await postSkillsUpdate(provider, ctx.rootStore, [])
		}
	})

	// ── createSkill ───────────────────────────────────────────────────
	bus.register(IntentType.SettingsSkillCreate, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}

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

			requireSkillFields(skillName, source, skillDescription)

			const skillsManager = requireSkillsManager(ctx.rootStore)
			const createdPath = await skillsManager.createSkill(skillName, source, skillDescription, modeSlugs)

			openFile(createdPath)

			const skills = skillsManager.getSkillsMetadata()
			await postSkillsUpdate(provider, ctx.rootStore, skills)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			backendLog.info(`Error creating skill: ${errorMessage}`)
			publishNotificationError(`Failed to create skill: ${errorMessage}`)
		}
	})

	// ── deleteSkill ───────────────────────────────────────────────────
	bus.register(IntentType.SettingsSkillDelete, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}

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

			requireSkillFields(skillName, source)

			const skillsManager = requireSkillsManager(ctx.rootStore)
			await skillsManager.deleteSkill(skillName, source, skillMode)

			const skills = skillsManager.getSkillsMetadata()
			await postSkillsUpdate(provider, ctx.rootStore, skills)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			backendLog.info(`Error deleting skill: ${errorMessage}`)
			publishNotificationError(`Failed to delete skill: ${errorMessage}`)
		}
	})

	// ── moveSkill ─────────────────────────────────────────────────────
	bus.register(IntentType.SettingsSkillMove, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}

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

			requireSkillFields(skillName, source)

			const skillsManager = requireSkillsManager(ctx.rootStore)
			await skillsManager.moveSkill(skillName, source, currentMode, newMode)

			const skills = skillsManager.getSkillsMetadata()
			await postSkillsUpdate(provider, ctx.rootStore, skills)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			backendLog.info(`Error moving skill: ${errorMessage}`)
			publishNotificationError(`Failed to move skill: ${errorMessage}`)
		}
	})

	// ── updateSkillModes ──────────────────────────────────────────────
	bus.register(IntentType.SettingsSkillModesUpdate, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}

		const payload = intent.payload as {
			skillName: string
			source: string
			newSkillModeSlugs?: string[]
		}

		try {
			const skillName = payload.skillName
			const source = payload.source as SkillSource
			const newModeSlugs = payload.newSkillModeSlugs

			requireSkillFields(skillName, source)

			const skillsManager = requireSkillsManager(ctx.rootStore)
			await skillsManager.updateSkillModes(skillName, source, newModeSlugs)

			const skills = skillsManager.getSkillsMetadata()
			await postSkillsUpdate(provider, ctx.rootStore, skills)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			backendLog.info(`Error updating skill modes: ${errorMessage}`)
			publishNotificationError(`Failed to update skill modes: ${errorMessage}`)
		}
	})

	// ── openSkillFile ─────────────────────────────────────────────────
	bus.register(IntentType.SettingsSkillFileOpen, async (intent, ctx) => {
		const provider = ctx.provider
		if (!provider) {
			return
		}

		const payload = intent.payload as {
			skillName: string
			source: string
		}

		try {
			const skillName = payload.skillName
			const source = payload.source as SkillSource

			requireSkillFields(skillName, source)

			const skillsManager = requireSkillsManager(ctx.rootStore)
			const skill = skillsManager.findSkillByNameAndSource(skillName, source)
			if (!skill) {
				throw new Error(t("skills:errors.skill_not_found", { name: skillName }))
			}

			openFile(skill.path)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			backendLog.info(`Error opening skill file: ${errorMessage}`)
			publishNotificationError(`Failed to open skill file: ${errorMessage}`)
		}
	})
}

import { publishNotificationError } from "@features/foundation/capabilities/notifications"
