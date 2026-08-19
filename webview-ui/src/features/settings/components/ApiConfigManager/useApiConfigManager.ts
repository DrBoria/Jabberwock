import { useEffect, useRef, useState } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import type { ProviderSettingsEntry } from "@jabberwock/types"
import type { ApiConfigManagerProps } from "./types"

export const useApiConfigManager = ({
	currentApiConfigName = "",
	listApiConfigMeta = [],
	organizationAllowList,
	onSelectConfig,
	onDeleteConfig,
	onRenameConfig,
	onUpsertConfig,
}: ApiConfigManagerProps) => {
	const { t } = useAppTranslation()
	const [isRenaming, setIsRenaming] = useState(false)
	const [isCreating, setIsCreating] = useState(false)
	const [inputValue, setInputValue] = useState("")
	const [newProfileName, setNewProfileName] = useState("")
	const [error, setError] = useState<string | null>(null)
	const inputRef = useRef<HTMLElement>(null)
	const newProfileInputRef = useRef<HTMLElement>(null)

	const isProfileValid = (profile: ProviderSettingsEntry): boolean => {
		if (!organizationAllowList || organizationAllowList.allowAll) return true
		const provider = profile.apiProvider
		if (!provider) return true
		const providerConfig = organizationAllowList.providers[provider]
		if (!providerConfig) return false
		return !!providerConfig.allowAll || !!(providerConfig.models && providerConfig.models.length > 0)
	}

	const validateName = (name: string, isNewProfile: boolean): string | null => {
		const trimmed = name.trim()
		if (!trimmed) return t("settings:providers.nameEmpty")
		const nameExists = listApiConfigMeta?.some((config) => config.name.toLowerCase() === trimmed.toLowerCase())
		if (isNewProfile && nameExists) return t("settings:providers.nameExists")
		if (!isNewProfile && nameExists && trimmed.toLowerCase() !== currentApiConfigName?.toLowerCase())
			return t("settings:providers.nameExists")
		return null
	}

	const resetCreateState = (): void => {
		setIsCreating(false)
		setNewProfileName("")
		setError(null)
	}
	const resetRenameState = (): void => {
		setIsRenaming(false)
		setInputValue("")
		setError(null)
	}

	useEffect(() => {
		if (isRenaming) {
			const id = setTimeout(() => inputRef.current?.focus(), 0)
			return () => clearTimeout(id)
		}
	}, [isRenaming])

	useEffect(() => {
		if (isCreating) {
			const id = setTimeout(() => newProfileInputRef.current?.focus(), 0)
			return () => clearTimeout(id)
		}
	}, [isCreating])

	useEffect(() => {
		resetCreateState()
		resetRenameState()
	}, [currentApiConfigName])

	const handleSelectConfig = (configName: string): void => {
		if (configName) onSelectConfig(configName)
	}
	const handleAdd = (): void => {
		resetCreateState()
		setIsCreating(true)
	}
	const handleStartRename = (): void => {
		setIsRenaming(true)
		setInputValue(currentApiConfigName || "")
		setError(null)
	}
	const handleCancel = (): void => {
		resetRenameState()
	}

	const handleSave = (): void => {
		const trimmedValue = inputValue.trim()
		const err = validateName(trimmedValue, false)
		if (err) {
			setError(err)
			return
		}
		if (isRenaming && currentApiConfigName) {
			if (currentApiConfigName === trimmedValue) {
				resetRenameState()
				return
			}
			onRenameConfig(currentApiConfigName, trimmedValue)
		}
		resetRenameState()
	}

	const handleNewProfileSave = (): void => {
		const trimmedValue = newProfileName.trim()
		const err = validateName(trimmedValue, true)
		if (err) {
			setError(err)
			return
		}
		onUpsertConfig(trimmedValue)
		resetCreateState()
	}

	const handleDelete = (): void => {
		if (!currentApiConfigName || !listApiConfigMeta || listApiConfigMeta.length <= 1) return
		onDeleteConfig(currentApiConfigName)
	}

	const isOnlyProfile = listApiConfigMeta?.length === 1

	return {
		t,
		isRenaming,
		isCreating,
		setIsCreating,
		inputValue,
		setInputValue,
		newProfileName,
		setNewProfileName,
		error,
		setError,
		inputRef,
		newProfileInputRef,
		isProfileValid,
		currentApiConfigName,
		listApiConfigMeta,
		handleSelectConfig,
		handleAdd,
		handleStartRename,
		handleCancel,
		handleSave,
		handleNewProfileSave,
		handleDelete,
		isOnlyProfile,
		resetCreateState,
	}
}
