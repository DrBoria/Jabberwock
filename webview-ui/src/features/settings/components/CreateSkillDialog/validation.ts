import { validateSkillName as validateSkillNameShared, SkillNameValidationError } from "@jabberwock/types"

const getSkillNameErrorTranslationKey = (error: SkillNameValidationError): string => {
	switch (error) {
		case SkillNameValidationError.Empty:
			return "settings:skills.validation.nameRequired"
		case SkillNameValidationError.TooLong:
			return "settings:skills.validation.nameTooLong"
		case SkillNameValidationError.InvalidFormat:
			return "settings:skills.validation.nameInvalid"
	}
}

export const validateSkillName = (name: string): string | null => {
	const result = validateSkillNameShared(name)
	return result.valid ? null : getSkillNameErrorTranslationKey(result.error!)
}

export const validateDescription = (description: string): string | null => {
	if (!description) return "settings:skills.validation.descriptionRequired"
	if (description.length > 1024) return "settings:skills.validation.descriptionTooLong"
	return null
}
