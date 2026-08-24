import { memo } from "react"
import type { ApiConfigManagerProps } from "./types"
import { useApiConfigManager } from "./useApiConfigManager"
import { ApiConfigRenameForm } from "./ApiConfigRenameForm"
import { ApiConfigSelectorSection } from "./ApiConfigSelectorSection"
import { ApiConfigCreateDialog } from "./ApiConfigCreateDialog"

const ApiConfigManager = (props: ApiConfigManagerProps) => {
	const {
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
	} = useApiConfigManager(props)

	return (
		<div className="flex flex-col gap-1">
			<label className="block font-medium mb-1">{t("settings:providers.configProfile")}</label>

			{isRenaming ? (
				<ApiConfigRenameForm
					inputValue={inputValue}
					error={error}
					inputRef={inputRef}
					onInputChange={setInputValue}
					onSave={handleSave}
					onCancel={handleCancel}
					onClearError={() => setError(null)}
					t={t}
				/>
			) : (
				<ApiConfigSelectorSection
					currentApiConfigName={currentApiConfigName}
					listApiConfigMeta={listApiConfigMeta}
					isOnlyProfile={isOnlyProfile}
					isProfileValid={isProfileValid}
					onSelectConfig={handleSelectConfig}
					onAdd={handleAdd}
					onStartRename={handleStartRename}
					onDelete={handleDelete}
					t={t}
				/>
			)}

			<ApiConfigCreateDialog
				open={isCreating}
				newProfileName={newProfileName}
				error={error}
				newProfileInputRef={newProfileInputRef}
				onOpenChange={setIsCreating}
				onNameChange={setNewProfileName}
				onSave={handleNewProfileSave}
				onCancel={resetCreateState}
				onClearError={() => setError(null)}
				t={t}
			/>
		</div>
	)
}

export default memo(ApiConfigManager)
