import { z } from "zod"

import { organizationSettingsSchema, userSettingsDataSchema } from "@jabberwock/types"

export const parseExtensionSettingsResponse = (data: unknown) => {
	const shapeResult = z.object({ organization: z.unknown(), user: z.unknown() }).safeParse(data)

	if (!shapeResult.success) {
		return { success: false, error: shapeResult.error } as const
	}

	const orgResult = organizationSettingsSchema.safeParse(shapeResult.data.organization)

	if (!orgResult.success) {
		return { success: false, error: orgResult.error } as const
	}

	const userResult = userSettingsDataSchema.safeParse(shapeResult.data.user)

	if (!userResult.success) {
		return { success: false, error: userResult.error } as const
	}

	return {
		success: true,
		data: { organization: orgResult.data, user: userResult.data },
	} as const
}
