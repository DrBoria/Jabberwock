import type { CloudUserInfo, CloudOrganizationMembership } from "@jabberwock/types"

import { getClerkBaseUrl } from "../config.ts"
import { getUserAgent } from "../utils.ts"
import { clerkOrganizationMembershipsSchema } from "./web-auth-schemas.ts"

interface ClerkApiDependencies {
	credentials: AuthCredentials | null
	getStoredOrganizationId: () => string | null
	log: (...args: unknown[]) => void
	context: { extension?: { packageJSON?: { publisher?: string; name?: string } } }
}

import type { AuthCredentials } from "./web-auth-schemas.ts"

function buildUserInfoFromClerkData(userData: Record<string, unknown>): CloudUserInfo {
	const data = userData as {
		id?: string
		first_name?: string | null
		last_name?: string | null
		image_url?: string
		primary_email_address_id?: string
		email_addresses?: Array<{ id: string; email_address: string }>
	}

	const userInfo: CloudUserInfo = {
		id: data.id,
		picture: data.image_url,
	}

	const names = [data.first_name, data.last_name].filter((name) => !!name)
	userInfo.name = names.length > 0 ? names.join(" ") : undefined

	const primaryEmailAddressId = data.primary_email_address_id
	const emailAddresses = data.email_addresses

	if (primaryEmailAddressId && emailAddresses) {
		userInfo.email = emailAddresses.find((email) => primaryEmailAddressId === email.id)?.email_address
	}

	return userInfo
}

function findOrganizationMembership(
	memberships: CloudOrganizationMembership[],
	organizationId: string,
): CloudOrganizationMembership | undefined {
	return memberships?.find((membership) => membership.organization.id === organizationId)
}

function findPrimaryOrganizationMembership(
	memberships: CloudOrganizationMembership[],
): CloudOrganizationMembership | undefined {
	return memberships && memberships.length > 0 ? memberships[0] : undefined
}

function setUserOrganizationInfo(userInfo: CloudUserInfo, membership: CloudOrganizationMembership): void {
	userInfo.organizationId = membership.organization.id
	userInfo.organizationName = membership.organization.name
	userInfo.organizationRole = membership.role
	userInfo.organizationImageUrl = membership.organization.image_url
}

async function enrichWithKnownOrgContext(
	userInfo: CloudUserInfo,
	storedOrgId: string | null,
	deps: ClerkApiDependencies,
): Promise<void> {
	if (storedOrgId === null) {
		deps.log("[auth] User in personal account context - not setting organization info")
		return
	}

	const orgMemberships = await clerkGetOrganizationMemberships(deps)
	const userMembership = findOrganizationMembership(orgMemberships, storedOrgId)

	if (userMembership) {
		setUserOrganizationInfo(userInfo, userMembership)
		deps.log("[auth] User in organization context:", {
			id: userMembership.organization.id,
			name: userMembership.organization.name,
			role: userMembership.role,
		})
	} else {
		deps.log("[auth] Warning: User not found in stored organization:", storedOrgId)
	}
}

async function enrichWithLegacyOrgContext(userInfo: CloudUserInfo, deps: ClerkApiDependencies): Promise<void> {
	const orgMemberships = await clerkGetOrganizationMemberships(deps)
	const primaryOrgMembership = findPrimaryOrganizationMembership(orgMemberships)

	if (primaryOrgMembership) {
		setUserOrganizationInfo(userInfo, primaryOrgMembership)
		deps.log("[auth] Legacy credentials: Found organization membership:", {
			id: primaryOrgMembership.organization.id,
			name: primaryOrgMembership.organization.name,
			role: primaryOrgMembership.role,
		})
	} else {
		deps.log("[auth] Legacy credentials: No organization memberships found")
	}
}

async function enrichWithOrganizationInfo(userInfo: CloudUserInfo, deps: ClerkApiDependencies): Promise<void> {
	try {
		const storedOrgId = deps.getStoredOrganizationId()

		if (deps.credentials?.organizationId !== undefined) {
			await enrichWithKnownOrgContext(userInfo, storedOrgId, deps)
		} else {
			await enrichWithLegacyOrgContext(userInfo, deps)
		}
	} catch (error) {
		deps.log("[auth] Failed to fetch organization info:", error)
	}
}

async function clerkGetOrganizationMemberships(deps: ClerkApiDependencies): Promise<CloudOrganizationMembership[]> {
	if (!deps.credentials) {
		deps.log("[auth] Cannot get organization memberships: missing credentials")
		return []
	}

	const response = await fetch(`${getClerkBaseUrl()}/v1/me/organization_memberships`, {
		headers: {
			Authorization: `Bearer ${deps.credentials.clientToken}`,
			"User-Agent": getUserAgent(deps.context),
		},
		signal: AbortSignal.timeout(10000),
	})

	if (response.ok) {
		return (clerkOrganizationMembershipsSchema.parse(await response.json()).response || []).map((membership) => ({
			...membership,
			id: membership.id,
			organization: {
				...membership.organization,
				id: membership.organization.id,
				name: membership.organization.name ?? "",
			},
		})) as CloudOrganizationMembership[]
	}

	const errorMessage = `Failed to get organization memberships: ${response.status} ${response.statusText}`
	deps.log(`[auth] ${errorMessage}`)
	throw new Error(errorMessage)
}

export {
	type ClerkApiDependencies,
	buildUserInfoFromClerkData,
	enrichWithOrganizationInfo,
	clerkGetOrganizationMemberships,
}
