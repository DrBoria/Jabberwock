import { useTranslation } from "react-i18next"
import i18next, { loadTranslations } from "./setup"
import { useEffect } from "react"
import { useExtensionState } from "@/context/ExtensionStateContext"

// Custom hook for translations
export const useAppTranslation = () => {
	const { i18n } = useTranslation()
	const extensionState = useExtensionState()

	// Load translations once when the hook is first used
	useEffect(() => {
		try {
			loadTranslations()
		} catch (error) {
			console.error("Failed to load translations:", error)
		}
	}, [])

	useEffect(() => {
		i18n.changeLanguage(extensionState.language)
	}, [i18n, extensionState.language])

	return {
		t: (key: string, options?: Record<string, unknown>) => i18n.t(key, options),
		i18n,
	}
}

export { i18next }
