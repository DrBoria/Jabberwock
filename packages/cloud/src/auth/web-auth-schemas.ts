import { z } from "zod"

/**
 * AuthCredentials
 */

export const authCredentialsSchema = z.object({
	clientToken: z.string().min(1, "Client token cannot be empty"),
	sessionId: z.string().min(1, "Session ID cannot be empty"),
	organizationId: z.string().nullable().optional(),
})

export type AuthCredentials = z.infer<typeof authCredentialsSchema>

/**
 * Clerk Schemas
 */

export const clerkSignInResponseSchema = z.object({
	response: z.object({
		created_session_id: z.string(),
	}),
})

export const clerkCreateSessionTokenResponseSchema = z.object({
	jwt: z.string(),
})

export const clerkMeResponseSchema = z.object({
	response: z.object({
		id: z.string().optional(),
		first_name: z.string().nullish(),
		last_name: z.string().nullish(),
		image_url: z.string().optional(),
		primary_email_address_id: z.string().optional(),
		email_addresses: z
			.array(
				z.object({
					id: z.string(),
					email_address: z.string(),
				}),
			)
			.optional(),
		public_metadata: z.record(z.any()).optional(),
	}),
})

export const clerkOrganizationMembershipsSchema = z.object({
	response: z.array(
		z.object({
			id: z.string(),
			role: z.string(),
			permissions: z.array(z.string()).optional(),
			created_at: z.number().optional(),
			updated_at: z.number().optional(),
			organization: z.object({
				id: z.string(),
				name: z.string(),
				slug: z.string().optional(),
				image_url: z.string().optional(),
				has_image: z.boolean().optional(),
				created_at: z.number().optional(),
				updated_at: z.number().optional(),
			}),
		}),
	),
})
