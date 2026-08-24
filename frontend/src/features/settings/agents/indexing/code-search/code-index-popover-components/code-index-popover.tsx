import { observer } from "mobx-react-lite"
import { useAppTranslation } from "@src/i18n/TranslationContext"

import { Popover, PopoverContent } from "@src/shared/ui/overlays/popover"
import { useJabberwockPortal } from "@src/features/foundation/ui/hooks/useJabberwock/useJabberwockPortal"

import { useCodeIndexState } from "../code-index-popover-logic/code-index-popover-hooks"
import {
	useCodeIndexCallbacks,
	useCodeIndexRouterProviders,
} from "../code-index-popover-logic/code-index-popover-callbacks"
import { PopoverHeader, EnableCheckbox, IndexingStatusSection, UnsavedChangesDialog } from "./code-index-popover-ui"
import { SetupConfigSection } from "./code-index-popover-setup-config"
import { AdvancedSettingsSection } from "./code-index-popover-advanced-settings"
import { PopoverToggleSection, PopoverActionButtons } from "./code-index-popover-actions"
import type { CodeIndexPopoverProps } from "../code-index-popover-logic/code-index-popover-types"

export const CodeIndexPopover: React.FC<CodeIndexPopoverProps> = observer(
	({ children, indexingStatus: externalIndexingStatus }) => {
		const { t } = useAppTranslation()

		const state = useCodeIndexState(externalIndexingStatus)
		const {
			open,
			setOpen,
			isAdvancedSettingsOpen,
			setIsAdvancedSettingsOpen,
			isSetupSettingsOpen,
			setIsSetupSettingsOpen,
			currentSettings,
			initialSettings,
			formErrors,
			updateSetting,
			codebaseIndexModels,
			apiConfiguration,
			isDiscardDialogShow,
			setDiscardDialogShow,
			confirmDialogHandler,
			setCurrentSettings,
			setFormErrors,
			setSaveStatus,
			setSaveError,
			indexingStatus,
			hasUnsavedChanges,
		} = state
		const callbacks = useCodeIndexCallbacks(
			currentSettings,
			initialSettings,
			hasUnsavedChanges,
			indexingStatus,
			open,
			setOpen,
			confirmDialogHandler,
			setDiscardDialogShow,
			setCurrentSettings,
			setFormErrors,
			setSaveStatus,
			setSaveError,
			updateSetting,
			apiConfiguration,
		)

		const {
			handlePopoverOpenChange,
			handleProviderChange,
			handleSaveSettings,
			getAvailableModels,
			progressPercentage,
			onConfirmDialogResult,
		} = callbacks

		const { data: openRouterEmbeddingProviders } = useCodeIndexRouterProviders(
			currentSettings.codebaseIndexEmbedderProvider,
			currentSettings.codebaseIndexEmbedderModelId,
			currentSettings.codebaseIndexEmbedderModelId,
		)
		const portalContainer = useJabberwockPortal("jabberwock-portal")

		return (
			<>
				<Popover open={open} onOpenChange={handlePopoverOpenChange}>
					{children}
					<PopoverContent
						className="w-[calc(100vw-32px)] max-w-[450px] max-h-[80vh] overflow-y-auto p-0"
						align="end"
						alignOffset={0}
						side="bottom"
						sideOffset={5}
						collisionPadding={16}
						avoidCollisions={true}
						container={portalContainer}>
						<PopoverHeader t={t} />
						<div className="p-4">
							<EnableCheckbox
								checked={currentSettings.codebaseIndexEnabled}
								onChange={(checked) => updateSetting("codebaseIndexEnabled", checked)}
								t={t}
							/>
							<div className="mb-4">
								<IndexingStatusSection
									indexingStatus={indexingStatus}
									progressPercentage={progressPercentage}
									t={t}
								/>
							</div>
							<SetupConfigSection
								isSetupSettingsOpen={isSetupSettingsOpen}
								setIsSetupSettingsOpen={setIsSetupSettingsOpen}
								currentSettings={currentSettings}
								formErrors={formErrors}
								updateSetting={updateSetting}
								handleProviderChange={handleProviderChange as (value: string) => void}
								getAvailableModels={getAvailableModels}
								codebaseIndexModels={codebaseIndexModels}
								openRouterEmbeddingProviders={openRouterEmbeddingProviders}
								t={t}
							/>
							<AdvancedSettingsSection
								currentSettings={currentSettings}
								updateSetting={updateSetting}
								t={t}
								isAdvancedSettingsOpen={isAdvancedSettingsOpen}
								setIsAdvancedSettingsOpen={setIsAdvancedSettingsOpen}
							/>
							<PopoverToggleSection
								currentSettings={currentSettings}
								indexingStatus={indexingStatus}
								t={t}
							/>
							<PopoverActionButtons
								currentSettings={currentSettings}
								indexingStatus={indexingStatus}
								saveStatus={state.saveStatus}
								hasUnsavedChanges={hasUnsavedChanges}
								handleSaveSettings={handleSaveSettings}
								saveError={state.saveError}
								t={t}
							/>
						</div>
					</PopoverContent>
				</Popover>
				<UnsavedChangesDialog
					isDiscardDialogShow={isDiscardDialogShow}
					setDiscardDialogShow={setDiscardDialogShow}
					onConfirmDialogResult={onConfirmDialogResult}
					t={t}
				/>
			</>
		)
	},
)
