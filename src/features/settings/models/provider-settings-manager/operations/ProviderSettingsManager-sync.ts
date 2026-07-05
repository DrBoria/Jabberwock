import { type ProviderSettingsWithId } from "@jabberwock/types"

import {
	type ProviderSettingsDeps,
	type SyncCloudProfilesResult,
	type SyncContext,
} from "@features/settings/models/provider-settings-manager/ProviderSettingsManager-types"
import {
	deleteRemovedCloudProfiles,
	updateExistingCloudProfile,
	addNewCloudProfile,
	handlePostSyncSteps,
} from "./ProviderSettingsManager-sync-helpers"
import type { ProviderProfiles } from "@features/settings/models/provider-settings-manager/ProviderSettingsManager-types"

async function syncCloudProfilesCore(
	cloudProfiles: Record<string, ProviderSettingsWithId>,
	currentActiveProfileName: string | undefined,
	load: () => Promise<ProviderProfiles>,
	store: (profiles: ProviderProfiles) => Promise<void>,
	generateId: () => string,
): Promise<SyncCloudProfilesResult> {
	const providerProfiles = await load()
	const ctx: SyncContext = {
		changedProfiles: [],
		existingNames: new Set(Object.keys(providerProfiles.apiConfigs)),
		activeProfileChanged: false,
		activeProfileId: "",
	}

	if (currentActiveProfileName && providerProfiles.apiConfigs[currentActiveProfileName]) {
		ctx.activeProfileId = providerProfiles.apiConfigs[currentActiveProfileName].id || ""
	}

	const currentCloudIds = new Set(providerProfiles.cloudProfileIds || [])
	const newCloudIds = new Set(
		Object.values(cloudProfiles)
			.map((p) => p.id)
			.filter((id): id is string => Boolean(id)),
	)

	deleteRemovedCloudProfiles(providerProfiles, ctx, currentCloudIds, newCloudIds, currentActiveProfileName)

	for (const [cloudName, cloudProfile] of Object.entries(cloudProfiles)) {
		if (!cloudProfile.id) {
			continue
		}

		const existingEntry = Object.entries(providerProfiles.apiConfigs).find(
			([_, profile]) => profile.id === cloudProfile.id,
		)

		if (existingEntry) {
			updateExistingCloudProfile(
				providerProfiles,
				ctx,
				existingEntry,
				cloudName,
				cloudProfile,
				currentActiveProfileName,
			)
		} else {
			addNewCloudProfile(providerProfiles, ctx, cloudName, cloudProfile)
		}
	}

	handlePostSyncSteps(providerProfiles, ctx, newCloudIds, generateId)

	await store(providerProfiles)

	return {
		hasChanges: ctx.changedProfiles.length > 0,
		activeProfileChanged: ctx.activeProfileChanged,
		activeProfileId: ctx.activeProfileId,
	}
}

export async function syncCloudProfiles(
	cloudProfiles: Record<string, ProviderSettingsWithId>,
	currentActiveProfileName: string | undefined,
	deps: Pick<ProviderSettingsDeps, "lock" | "load" | "store" | "generateId">,
): Promise<SyncCloudProfilesResult> {
	try {
		return await deps.lock(async () => {
			return syncCloudProfilesCore(
				cloudProfiles,
				currentActiveProfileName,
				deps.load,
				deps.store,
				deps.generateId,
			)
		})
	} catch (error) {
		throw new Error(`Failed to sync cloud profiles: ${error}`)
	}
}
