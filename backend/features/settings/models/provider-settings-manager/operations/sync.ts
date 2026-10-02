import deepEqual from "fast-deep-equal"

import { type ProviderSettingsWithId, isSecretStateKey } from "@jabberwock/types"

import {
	type ProviderProfiles,
	type ProviderSettingsDeps,
	type SyncCloudProfilesResult,
	type SyncContext,
} from "@features/settings"

export function findUniqueProfileName(baseName: string, existingNames: Set<string>): string {
	if (!existingNames.has(baseName)) {
		return baseName
	}

	const localName = `${baseName}_local`
	if (!existingNames.has(localName)) {
		return localName
	}

	let counter = 1
	let candidateName: string
	do {
		candidateName = `${baseName}_${counter}`
		counter++
	} while (existingNames.has(candidateName))

	return candidateName
}

export function deleteRemovedCloudProfiles(
	providerProfiles: ProviderProfiles,
	ctx: SyncContext,
	currentCloudIds: Set<string>,
	newCloudIds: Set<string>,
	currentActiveProfileName?: string,
): void {
	for (const [name, profile] of Object.entries(providerProfiles.apiConfigs)) {
		if (!profile.id || !currentCloudIds.has(profile.id) || newCloudIds.has(profile.id)) {
			continue
		}

		if (name === currentActiveProfileName) {
			ctx.activeProfileChanged = true
			ctx.activeProfileId = ""
		}
		delete providerProfiles.apiConfigs[name]
		ctx.changedProfiles.push(name)
		ctx.existingNames.delete(name)
	}
}

export function updateExistingCloudProfile(
	providerProfiles: ProviderProfiles,
	ctx: SyncContext,
	existingEntry: [string, ProviderSettingsWithId],
	cloudName: string,
	cloudProfile: ProviderSettingsWithId,
	currentActiveProfileName?: string,
): void {
	const [existingName, existingProfile] = existingEntry
	const isActiveProfile = existingName === currentActiveProfileName

	const updatedProfile: ProviderSettingsWithId = { ...cloudProfile }
	for (const [key, value] of Object.entries(existingProfile)) {
		if (isSecretStateKey(key) && value !== undefined) {
			;(updatedProfile as { [key: string]: unknown })[key] = value
		}
	}

	const profileChanged = !deepEqual(existingProfile, updatedProfile)

	if (existingName !== cloudName) {
		handleCloudProfileRename(
			providerProfiles,
			ctx,
			existingName,
			cloudName,
			cloudProfile,
			updatedProfile,
			isActiveProfile,
		)
	} else if (profileChanged) {
		providerProfiles.apiConfigs[existingName] = updatedProfile
		ctx.changedProfiles.push(existingName)
		if (isActiveProfile) {
			ctx.activeProfileChanged = true
			ctx.activeProfileId = cloudProfile.id || ""
		}
	}
}

export function handleCloudProfileRename(
	providerProfiles: ProviderProfiles,
	ctx: SyncContext,
	existingName: string,
	cloudName: string,
	cloudProfile: ProviderSettingsWithId,
	updatedProfile: ProviderSettingsWithId,
	isActiveProfile: boolean,
): void {
	delete providerProfiles.apiConfigs[existingName]
	ctx.existingNames.delete(existingName)

	let finalName = cloudName
	if (ctx.existingNames.has(cloudName)) {
		const conflictingProfile = providerProfiles.apiConfigs[cloudName]
		if (conflictingProfile.id !== cloudProfile.id) {
			const newName = findUniqueProfileName(cloudName, ctx.existingNames)
			providerProfiles.apiConfigs[newName] = conflictingProfile
			ctx.existingNames.add(newName)
			ctx.changedProfiles.push(newName)
		}
		delete providerProfiles.apiConfigs[cloudName]
		ctx.existingNames.delete(cloudName)
	}

	providerProfiles.apiConfigs[finalName] = updatedProfile
	ctx.existingNames.add(finalName)
	ctx.changedProfiles.push(finalName)
	if (existingName !== finalName) {
		ctx.changedProfiles.push(existingName)
	}

	if (isActiveProfile) {
		ctx.activeProfileChanged = true
		ctx.activeProfileId = cloudProfile.id || ""
	}
}

export function addNewCloudProfile(
	providerProfiles: ProviderProfiles,
	ctx: SyncContext,
	cloudName: string,
	cloudProfile: ProviderSettingsWithId,
): void {
	let finalName = cloudName

	if (ctx.existingNames.has(cloudName)) {
		const existingProfile = providerProfiles.apiConfigs[cloudName]
		if (existingProfile.id !== cloudProfile.id) {
			const newName = findUniqueProfileName(cloudName, ctx.existingNames)
			providerProfiles.apiConfigs[newName] = existingProfile
			ctx.existingNames.add(newName)
			ctx.changedProfiles.push(newName)
			delete providerProfiles.apiConfigs[cloudName]
			ctx.existingNames.delete(cloudName)
		}
	}

	const newProfile: ProviderSettingsWithId = { ...cloudProfile }
	for (const key of Object.keys(newProfile)) {
		if (isSecretStateKey(key)) {
			delete (newProfile as { [key: string]: unknown })[key]
		}
	}

	providerProfiles.apiConfigs[finalName] = newProfile
	ctx.existingNames.add(finalName)
	ctx.changedProfiles.push(finalName)
}

export function handlePostSyncSteps(
	providerProfiles: ProviderProfiles,
	ctx: SyncContext,
	newCloudIds: Set<string>,
	generateId: () => string,
): void {
	if (Object.keys(providerProfiles.apiConfigs).length === 0 && ctx.changedProfiles.length > 0) {
		const defaultProfile = { id: generateId() }
		providerProfiles.apiConfigs["default"] = defaultProfile
		ctx.activeProfileChanged = true
		ctx.activeProfileId = defaultProfile.id || ""
		ctx.changedProfiles.push("default")
	}

	if (ctx.activeProfileChanged && !ctx.activeProfileId) {
		const firstProfile = Object.values(providerProfiles.apiConfigs)[0]
		if (firstProfile?.id) {
			ctx.activeProfileId = firstProfile.id
		}
	}

	providerProfiles.cloudProfileIds = Array.from(newCloudIds)
}

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
