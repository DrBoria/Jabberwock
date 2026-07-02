import { z } from "zod"

import { globalSettingsSchema } from "../settings/global/schema.ts"
import { providerSettingsWithIdSchema } from "../settings/provider/combined-schemas.ts"
import { mcpMarketplaceItemSchema } from "../features/marketplace.ts"

/**
 * JWTPayload
 */

export interface JWTPayload {
	iss?: string // Issuer (should be 'rcc')
	sub?: string // Subject - CloudJob ID for job tokens (t:'cj'), User ID for auth tokens (t:'auth')
	exp?: number // Expiration time
	iat?: number // Issued at time
	nbf?: number // Not before time
	v?: number // Version (should be 1)
	r?: {
		u?: string // User ID (always present in valid tokens)
		o?: string // Organization ID (optional - undefined when orgId is null)
		t?: string // Token type: 'cj' for job tokens, 'auth' for auth tokens
	}
}

/**
 * CloudUserInfo
 */

export interface CloudUserInfo {
	id?: string
	name?: string
	email?: string
	picture?: string
	organizationId?: string
	organizationName?: string
	organizationRole?: string
	organizationImageUrl?: string
}

/**
 * CloudOrganization
 */

export interface CloudOrganization {
	id: string
	name: string
	slug?: string
	image_url?: string
	has_image?: boolean
	created_at?: number
	updated_at?: number
}

/**
 * CloudOrganizationMembership
 */

export interface CloudOrganizationMembership {
	id: string
	organization: CloudOrganization
	role: string
	permissions?: string[]
	created_at?: number
	updated_at?: number
}

/**
 * OrganizationAllowList
 */

export const organizationAllowListSchema = z.object({
	allowAll: z.boolean(),
	providers: z.record(
		z.object({
			allowAll: z.boolean(),
			models: z.array(z.string()).optional(),
		}),
	),
})

export type OrganizationAllowList = z.infer<typeof organizationAllowListSchema>

/**
 * OrganizationDefaultSettings
 */

export const organizationDefaultSettingsSchema = globalSettingsSchema
	.pick({
		enableCheckpoints: true,
		maxOpenTabsContext: true,
		maxWorkspaceFiles: true,
		showJabberwockIgnoredFiles: true,
		terminalCommandDelay: true,
		terminalShellIntegrationDisabled: true,
		terminalShellIntegrationTimeout: true,
		terminalZshClearEolMark: true,
		disabledTools: true,
	})
	// Add stronger validations for some fields.
	.merge(
		z.object({
			maxOpenTabsContext: z.number().int().nonnegative().optional(),
			maxWorkspaceFiles: z.number().int().nonnegative().optional(),
			terminalCommandDelay: z.number().int().nonnegative().optional(),
			terminalShellIntegrationTimeout: z.number().int().nonnegative().optional(),
		}),
	)

export type OrganizationDefaultSettings = z.infer<typeof organizationDefaultSettingsSchema>

/**
 * WorkspaceTaskVisibility
 */

const workspaceTaskVisibilitySchema = z.enum(["all", "list-only", "admins-and-creator", "creator", "full-lockdown"])

export type WorkspaceTaskVisibility = z.infer<typeof workspaceTaskVisibilitySchema>

/**
 * OrganizationCloudSettings
 */

export const organizationCloudSettingsSchema = z.object({
	recordTaskMessages: z.boolean().optional(),
	enableTaskSharing: z.boolean().optional(),
	allowPublicTaskSharing: z.boolean().optional(),
	taskShareExpirationDays: z.number().int().positive().optional(),
	allowMembersViewAllTasks: z.boolean().optional(),
	workspaceTaskVisibility: workspaceTaskVisibilitySchema.optional(),
	llmEnhancedFeaturesEnabled: z.boolean().optional(),
})

export type OrganizationCloudSettings = z.infer<typeof organizationCloudSettingsSchema>

/**
 * OrganizationFeatures
 */

export const organizationFeaturesSchema = z.object({})

export type OrganizationFeatures = z.infer<typeof organizationFeaturesSchema>

/**
 * OrganizationSettings
 */

export const organizationSettingsSchema = z.object({
	version: z.number(),
	cloudSettings: organizationCloudSettingsSchema.optional(),
	defaultSettings: organizationDefaultSettingsSchema,
	allowList: organizationAllowListSchema,
	features: organizationFeaturesSchema.optional(),
	hiddenMcps: z.array(z.string()).optional(),
	hideMarketplaceMcps: z.boolean().optional(),
	mcps: z.array(mcpMarketplaceItemSchema).optional(),
	providerProfiles: z.record(z.string(), providerSettingsWithIdSchema).optional(),
})

export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>

/**
 * User Settings Schemas
 */

export const userFeaturesSchema = z.object({})

export type UserFeatures = z.infer<typeof userFeaturesSchema>

export const userSettingsConfigSchema = z.object({
	taskSyncEnabled: z.boolean().optional(),
	llmEnhancedFeaturesEnabled: z.boolean().optional(),
})

export type UserSettingsConfig = z.infer<typeof userSettingsConfigSchema>

export const userSettingsDataSchema = z.object({
	features: userFeaturesSchema,
	settings: userSettingsConfigSchema,
	version: z.number(),
})

export type UserSettingsData = z.infer<typeof userSettingsDataSchema>

/**
 * Constants
 */

export const ORGANIZATION_ALLOW_ALL: OrganizationAllowList = {
	allowAll: true,
	providers: {},
} as const

export const ORGANIZATION_DEFAULT: OrganizationSettings = {
	version: 0,
	cloudSettings: {
		recordTaskMessages: true,
		enableTaskSharing: true,
		allowPublicTaskSharing: true,
		taskShareExpirationDays: 30,
		allowMembersViewAllTasks: true,
		llmEnhancedFeaturesEnabled: false,
	},
	defaultSettings: {},
	allowList: ORGANIZATION_ALLOW_ALL,
} as const
