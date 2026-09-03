import * as vscode from "vscode"

import { isProviderName, isRetiredProvider } from "@jabberwock/types"

import { logger } from "@utils/logging"
import { supportPrompt } from "@shared/support-prompt"

/**
 * Run all settings migrations in order.
 * Called once during extension activation after installBackendState().
 */
export async function runSettingsMigrations(context: vscode.ExtensionContext): Promise<void> {
	await migrateImageGenerationSettings(context)
	await migrateInvalidApiProvider(context)
	await migrateLegacyCondensingPrompt(context)
	await migrateOldDefaultCondensingPrompt(context)
	await migrateOldGlobalStateSnapshot(context)
}

// ─── Migration: Legacy condensing prompt ────────────────────────────────

async function migrateLegacyCondensingPrompt(context: vscode.ExtensionContext) {
	try {
		const legacyPrompt = context.globalState.get<string>("customCondensingPrompt")
		if (legacyPrompt) {
			const currentSupportPrompts = context.globalState.get<Record<string, string>>("customSupportPrompts") || {}

			const isCustomized = legacyPrompt.trim() !== supportPrompt.default.CONDENSE.trim()
			if (!currentSupportPrompts.CONDENSE && isCustomized) {
				logger.info("Migrating customized legacy customCondensingPrompt to customSupportPrompts")
				const updatedPrompts = { ...currentSupportPrompts, CONDENSE: legacyPrompt }
				await context.globalState.update("customSupportPrompts", updatedPrompts)
			} else if (!isCustomized) {
				logger.info("Skipping migration: legacy customCondensingPrompt equals the default prompt")
			}

			await context.globalState.update("customCondensingPrompt", undefined)
		}
	} catch (error) {
		logger.error(
			`Error during customCondensingPrompt migration: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}

// ─── Migration: Old default condensing prompt ───────────────────────────

async function migrateOldDefaultCondensingPrompt(context: vscode.ExtensionContext) {
	try {
		const currentSupportPrompts = context.globalState.get<Record<string, string>>("customSupportPrompts") || {}

		const savedCondensePrompt = currentSupportPrompts.CONDENSE

		if (savedCondensePrompt && isOldV1DefaultCondensePrompt(savedCondensePrompt)) {
			logger.info(
				"Clearing old v1 default condensing prompt from customSupportPrompts.CONDENSE - user will now get the improved v2 default",
			)

			const { CONDENSE: _, ...remainingPrompts } = currentSupportPrompts
			const updatedPrompts = Object.keys(remainingPrompts).length > 0 ? remainingPrompts : undefined

			await context.globalState.update("customSupportPrompts", updatedPrompts)
		}
	} catch (error) {
		logger.error(
			`Error during old default condensing prompt migration: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}

function isOldV1DefaultCondensePrompt(prompt: string): boolean {
	const v1RequiredPhrases = [
		"Your task is to create a detailed summary of the conversation so far",
		"1. Previous Conversation:",
		"2. Current Work:",
		"3. Key Technical Concepts:",
		"4. Relevant Files and Code:",
		"5. Problem Solving:",
		"6. Pending Tasks and Next Steps:",
		"Output only the summary of the conversation so far",
	]

	const v2Features = ["<analysis>", "SYSTEM OPERATION", "Errors and fixes", "All user messages", "7.", "8.", "9."]

	const hasAllV1Phrases = v1RequiredPhrases.every((phrase) => prompt.toLowerCase().includes(phrase.toLowerCase()))

	const hasNoV2Features = v2Features.every((feature) => !prompt.toLowerCase().includes(feature.toLowerCase()))

	return hasAllV1Phrases && hasNoV2Features
}

// ─── Migration: Invalid API provider ────────────────────────────────────

async function migrateInvalidApiProvider(context: vscode.ExtensionContext) {
	try {
		const apiProvider = context.globalState.get<string | undefined>("apiProvider")
		const isKnownProvider =
			typeof apiProvider === "string" && (isProviderName(apiProvider) || isRetiredProvider(apiProvider))

		if (apiProvider !== undefined && !isKnownProvider) {
			logger.info(`[Migrations] Found invalid provider "${apiProvider}" in storage - clearing it`)
			await context.globalState.update("apiProvider", undefined)
		}
	} catch (error) {
		logger.error(
			`Error during invalid API provider migration: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}

// ─── Migration: Image generation settings ───────────────────────────────

async function migrateImageGenerationSettings(context: vscode.ExtensionContext) {
	try {
		const oldNestedSettings = context.globalState.get<unknown>("openRouterImageGenerationSettings")

		if (oldNestedSettings && typeof oldNestedSettings === "object") {
			logger.info("Migrating old nested image generation settings to flattened structure")
			const nestedSettings = oldNestedSettings as { [key: string]: unknown }

			if (nestedSettings.openRouterApiKey && !context.globalState.get("openRouterImageApiKey")) {
				await context.secrets.store("openRouterImageApiKey", nestedSettings.openRouterApiKey as string)
				logger.info("Migrated openRouterImageApiKey to secrets")
			}

			if (nestedSettings.selectedModel && !context.globalState.get("openRouterImageGenerationSelectedModel")) {
				await context.globalState.update(
					"openRouterImageGenerationSelectedModel",
					nestedSettings.selectedModel as string,
				)
				logger.info("Migrated openRouterImageGenerationSelectedModel to global state")
			}

			await context.globalState.update("openRouterImageGenerationSettings", undefined)
			logger.info("Removed old nested openRouterImageGenerationSettings")
		}
	} catch (error) {
		logger.error(
			`Error during image generation settings migration: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}

// ─── Migration: Remove old backend snapshot from globalState ─────────────
// The snapshot (~17.5MB) was previously stored in VS Code's key-value
// globalState via context.globalState.update(), which triggers
// "large extension state" warnings (~10MB limit).  It is now persisted
// to the file system (context.globalStorageUri / ".backend-snapshot.json").
const OLD_SNAPSHOT_KEY = "jabberwock.backendRootStore.snapshot"

async function migrateOldGlobalStateSnapshot(context: vscode.ExtensionContext) {
	try {
		const oldSnapshot = context.globalState.get(OLD_SNAPSHOT_KEY)
		if (oldSnapshot !== undefined) {
			logger.info(
				`[Migrations] Removing old backend root store snapshot from globalState (key: "${OLD_SNAPSHOT_KEY}")`,
			)
			await context.globalState.update(OLD_SNAPSHOT_KEY, undefined)
		}
	} catch (error) {
		logger.error(`Error during old snapshot migration: ${error instanceof Error ? error.message : String(error)}`)
	}
}
