import * as vscode from "vscode"

import { type ProviderSettings, type ProviderSettingsEntry, JabberwockEventName } from "@jabberwock/types"

import type { ClineProvider } from "../../webview/ClineProvider"

// ---------------------------------------------------------------------------
// Provider Profile Management (extracted from ClineProvider)
// ---------------------------------------------------------------------------

export function getProviderProfileEntries(provider: ClineProvider): ProviderSettingsEntry[] {
	const p = provider as any
	return p.contextProxy.getValues().listApiConfigMeta || []
}

export function getProviderProfileEntry(provider: ClineProvider, name: string): ProviderSettingsEntry | undefined {
	return getProviderProfileEntries(provider).find((profile) => profile.name === name)
}

export function hasProviderProfileEntry(provider: ClineProvider, name: string): boolean {
	return !!getProviderProfileEntry(provider, name)
}

export async function upsertProviderProfile(
	provider: ClineProvider,
	name: string,
	providerSettings: ProviderSettings,
	activate: boolean = true,
): Promise<string | undefined> {
	const p = provider as any

	try {
		// TODO: Do we need to be calling `activateProfile`? It's not
		// clear to me what the source of truth should be; in some cases
		// we rely on the `ContextProxy`'s data store and in other cases
		// we rely on the `ProviderSettingsManager`'s data store. It might
		// be simpler to unify these two.
		const id = await p.providerSettingsManager.saveConfig(name, providerSettings)

		if (activate) {
			const { mode } = await p.getState()

			// These promises do the following:
			// 1. Adds or updates the list of provider profiles.
			// 2. Sets the current provider profile.
			// 3. Sets the current mode's provider profile.
			// 4. Copies the provider settings to the context.
			//
			// Note: 1, 2, and 4 can be done in one `ContextProxy` call:
			// this.contextProxy.setValues({ ...providerSettings, listApiConfigMeta: ..., currentApiConfigName: ... })
			// We should probably switch to that and verify that it works.
			// I left the original implementation in just to be safe.
			await Promise.all([
				(p as any).updateGlobalState("listApiConfigMeta", await p.providerSettingsManager.listConfig()),
				(p as any).updateGlobalState("currentApiConfigName", name),
				p.providerSettingsManager.setModeConfig(mode, id),
				p.contextProxy.setProviderSettings(providerSettings),
			])

			// Change the provider for the current task.
			// TODO: We should rename `buildApiHandler` for clarity (e.g. `getProviderClient`).
			;(p as any).updateTaskApiHandlerIfNeeded(providerSettings, { forceRebuild: true })

			// Keep the current task's sticky provider profile in sync with the newly-activated profile.
			await persistStickyProviderProfileToCurrentTask(provider, name)
		} else {
			await (p as any).updateGlobalState("listApiConfigMeta", await p.providerSettingsManager.listConfig())
		}

		await p.postStateToWebview()
		return id
	} catch (error) {
		const { t } = await import("../../../i18n/index")
		p.log(`Error create new api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)

		vscode.window.showErrorMessage(t("common:errors.create_api_config"))
		return undefined
	}
}

export async function deleteProviderProfile(provider: ClineProvider, profileToDelete: ProviderSettingsEntry) {
	const p = provider as any
	const globalSettings = p.contextProxy.getValues()
	let profileToActivate: string | undefined = globalSettings.currentApiConfigName

	if (profileToDelete.name === profileToActivate) {
		profileToActivate = getProviderProfileEntries(provider).find(({ name }) => name !== profileToDelete.name)?.name
	}

	if (!profileToActivate) {
		throw new Error("You cannot delete the last profile")
	}

	const entries = getProviderProfileEntries(provider).filter(({ name }) => name !== profileToDelete.name)

	await p.contextProxy.setValues({
		...globalSettings,
		currentApiConfigName: profileToActivate,
		listApiConfigMeta: entries,
	})

	await p.postStateToWebview()
}

async function persistStickyProviderProfileToCurrentTask(
	provider: ClineProvider,
	apiConfigName: string,
): Promise<void> {
	const p = provider as any
	const task = p.getCurrentTask()
	if (!task) {
		return
	}

	try {
		// Update in-memory state immediately so sticky behavior works even before the task has
		// been persisted into taskHistory (it will be captured on the next save).
		task.setTaskApiConfigName(apiConfigName)

		const taskHistoryItem =
			p.taskHistoryStore.get(task.taskId) ??
			((p as any).getGlobalState("taskHistory") ?? []).find((item: any) => item.id === task.taskId)

		if (taskHistoryItem) {
			await (p as any).updateTaskHistory({ ...taskHistoryItem, apiConfigName })
		}
	} catch (error) {
		// If persistence fails, log the error but don't fail the profile switch.
		p.log(
			`Failed to persist provider profile switch for task ${task.taskId}: ${
				error instanceof Error ? error.message : String(error)
			}`,
		)
	}
}

export async function activateProviderProfile(
	provider: ClineProvider,
	args: { name: string } | { id: string },
	options?: { persistModeConfig?: boolean; persistTaskHistory?: boolean },
) {
	const p = provider as any
	const { name, id, ...providerSettings } = await p.providerSettingsManager.activateProfile(args)

	const persistModeConfig = options?.persistModeConfig ?? true
	const persistTaskHistory = options?.persistTaskHistory ?? true

	// See `upsertProviderProfile` for a description of what this is doing.
	await Promise.all([
		p.contextProxy.setValue("listApiConfigMeta", await p.providerSettingsManager.listConfig()),
		p.contextProxy.setValue("currentApiConfigName", name),
		p.contextProxy.setProviderSettings(providerSettings),
	])

	const { mode } = await p.getState()

	if (id && persistModeConfig) {
		await p.providerSettingsManager.setModeConfig(mode, id)
	}

	// Change the provider for the current task.
	;(p as any).updateTaskApiHandlerIfNeeded(providerSettings, { forceRebuild: true })

	// Update the current task's sticky provider profile, unless this activation is
	// being used purely as a non-persisting restoration (e.g., reopening a task from history).
	if (persistTaskHistory) {
		await persistStickyProviderProfileToCurrentTask(provider, name)
	}

	await p.postStateToWebview()

	if (providerSettings.apiProvider) {
		p.emit(JabberwockEventName.ProviderProfileChanged, { name, provider: providerSettings.apiProvider })
	}
}

export async function updateCustomInstructions(provider: ClineProvider, instructions?: string) {
	const p = provider as any
	// User may be clearing the field.
	await (p as any).updateGlobalState("customInstructions", instructions || undefined)
	await p.postStateToWebview()
}
