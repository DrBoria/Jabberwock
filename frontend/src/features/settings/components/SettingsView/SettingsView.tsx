import { forwardRef, memo, useImperativeHandle } from "react"
import { AlertTriangle, ArrowLeft } from "lucide-react"

import { Button } from "@src/shared/ui/buttons/button"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@src/shared/ui/overlays/alert-dialog"
import { Tab, TabContent, TabHeader } from "@src/features/foundation/components/ui/layout/Tab"

import { SettingsSearch } from "../settings-search/SettingsSearch"
import type { SettingsViewRef, SettingsViewProps } from "./types"
import { SettingsTabSidebar } from "./components/SettingsTabSidebar"
import { SettingsTabContent } from "./components/SettingsTabContent"
import { useSettingsState } from "./hooks/useSettingsState"

const SettingsView = forwardRef<SettingsViewRef, SettingsViewProps>(({ onDone, targetSection }, ref) => {
	const {
		t,
		isDiscardDialogShow,
		setDiscardDialogShow,
		errorMessage,
		setErrorMessage,
		isChangeDetected,
		activeTab,
		cachedState,
		apiConfiguration,
		currentApiConfigName,
		listApiConfigMeta,
		uriScheme,
		isCompactMode,
		sections,
		renderTab,
		searchIndex,
		setCachedStateField,
		setApiConfigurationField,
		setExperimentEnabled,
		setTelemetrySetting,
		setDebug,
		setImageGenerationProvider,
		setOpenRouterImageApiKey,
		setImageGenerationSelectedModel,
		setCustomSupportPromptsField,
		handleRenameConfig,
		handleSubmit,
		checkUnsaveChanges,
		onConfirmDialogResult,
		handleTabChange,
		handleSearchNavigate,
		tabRefs,
		contentRef,
		containerRef,
		isIndexing,
		saveButtonTooltip,
		containerClass,
		tabContentClass,
	} = useSettingsState(onDone, targetSection)

	useImperativeHandle(ref, () => ({ checkUnsaveChanges }), [checkUnsaveChanges])

	return (
		<Tab data-testid="settings-view">
			<TabHeader className="flex justify-between items-center gap-2">
				<div className="flex items-center gap-2 grow">
					<StandardTooltip content={t("settings:header.doneButtonTooltip")}>
						<Button variant="ghost" className="px-1.5 -ml-2" onClick={() => checkUnsaveChanges(onDone)}>
							<ArrowLeft />
							<span className="sr-only">{t("settings:common.done")}</span>
						</Button>
					</StandardTooltip>
					<h3 className="text-vscode-foreground m-0 flex-shrink-0">{t("settings:header.title")}</h3>
				</div>
				<div className="flex items-center gap-2 shrink-0">
					{!isIndexing && (
						<SettingsSearch index={searchIndex} onNavigate={handleSearchNavigate} sections={sections} />
					)}
					<StandardTooltip content={saveButtonTooltip}>
						<Button
							variant="primary"
							className={errorMessage ? "!border-vscode-errorForeground" : ""}
							onClick={handleSubmit}
							disabled={!isChangeDetected}
							data-testid="save-button">
							{t("settings:common.save")}
						</Button>
					</StandardTooltip>
				</div>
			</TabHeader>

			<div ref={containerRef} className={containerClass}>
				<SettingsTabSidebar
					sections={sections}
					activeTab={activeTab}
					isCompactMode={isCompactMode}
					onTabChange={handleTabChange}
					tabRefs={tabRefs}
					t={t}
				/>
				<TabContent ref={contentRef} className={tabContentClass} data-testid="settings-content">
					<SettingsTabContent
						renderTab={renderTab}
						cachedState={cachedState}
						apiConfiguration={apiConfiguration}
						currentApiConfigName={currentApiConfigName ?? ""}
						listApiConfigMeta={listApiConfigMeta ?? []}
						uriScheme={uriScheme}
						errorMessage={errorMessage}
						setErrorMessage={setErrorMessage}
						setCachedStateField={setCachedStateField}
						setApiConfigurationField={setApiConfigurationField}
						setExperimentEnabled={setExperimentEnabled}
						setTelemetrySetting={setTelemetrySetting}
						setDebug={setDebug}
						setImageGenerationProvider={setImageGenerationProvider}
						setOpenRouterImageApiKey={setOpenRouterImageApiKey}
						setImageGenerationSelectedModel={setImageGenerationSelectedModel}
						setCustomSupportPromptsField={setCustomSupportPromptsField}
						checkUnsaveChanges={checkUnsaveChanges}
						onRenameConfig={handleRenameConfig}
					/>
				</TabContent>
			</div>

			<AlertDialog open={isDiscardDialogShow} onOpenChange={setDiscardDialogShow}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							<AlertTriangle className="w-5 h-5 text-yellow-500" />
							{t("settings:unsavedChangesDialog.title")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("settings:unsavedChangesDialog.description")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => onConfirmDialogResult(false)}>
							{t("settings:unsavedChangesDialog.cancelButton")}
						</AlertDialogCancel>
						<AlertDialogAction onClick={() => onConfirmDialogResult(true)}>
							{t("settings:unsavedChangesDialog.discardButton")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Tab>
	)
})

export default memo(SettingsView)
