type ValidationResult = { success: boolean; error?: { errors: Array<{ path: (string | number)[]; message: string }> } }

type ValidationSetters = {
	setNameError: (v: string) => void
	setSlugError: (v: string) => void
	setDescriptionError: (v: string) => void
	setRoleDefinitionError: (v: string) => void
	setGroupsError: (v: string) => void
}

export function generateSlug(name: string, attempt = 0): string {
	const baseSlug = name
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "")
	return attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`
}

export function isNameOrSlugTaken(name: string, slug: string, modes: { slug: string; name: string }[]): boolean {
	return modes.some((m) => m.slug === slug || m.name === name)
}

export function validateModeErrors(result: ValidationResult, setters: ValidationSetters): boolean {
	if (result.success) return false

	result.error?.errors.forEach((error) => {
		const field = error.path[0] as string
		const message = error.message
		switch (field) {
			case "name":
				setters.setNameError(message)
				break
			case "slug":
				setters.setSlugError(message)
				break
			case "description":
				setters.setDescriptionError(message)
				break
			case "roleDefinition":
				setters.setRoleDefinitionError(message)
				break
			case "groups":
				setters.setGroupsError(message)
				break
		}
	})
	return true
}
