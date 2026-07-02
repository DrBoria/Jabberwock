import deepEqual from "fast-deep-equal"

import { type ProviderSettingsWithId, isSecretStateKey } from "@jabberwock/types"

import {
	type ProviderProfiles,
	type SyncContext,
} from "@features/settings/models/provider-settings-manager/ProviderSettingsManager-types"

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

// syncCloudProfilesCore is now in ProviderSettingsManager-sync.ts
