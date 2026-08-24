import React, { forwardRef } from "react"
import { observer } from "mobx-react-lite"
import { Container } from "@src/shared/ui/layouts/Container"
import { rootStore } from "@src/features/store"
import { useDndTextArea } from "./hooks/useDndTextArea"
import { GoalsSection } from "./components/GoalsSection"
import { EditModeGoalInput } from "./components/EditModeGoalInput"
import { BottomToolbar } from "./components/BottomToolbar"
import { TextareaWithHighlight } from "./components/TextareaWithHighlight"
import type { DndTextAreaProps } from "./types"

const DndTextAreaComponent = forwardRef<HTMLTextAreaElement, DndTextAreaProps>((props, ref) => {
	const h = useDndTextArea(props, ref)
	const {
		textAreaStore,
		mode,
		t,
		currentConfigId,
		displayName,
		allModes,
		hasTextInput,
		hasContent,
		isSendVisible,
		sendKeyCombination,
		queryItems,
		placeholderBottomText,
		containerClassName,
		innerDivClassName,
		contextMenuClassName,
		borderStyle,
		editModePadding,
		draggingBackground,
		showEditModeGoalInput,
		showContextMenu,
		showThumbnails,
		handleMentionSelect,
		handleInputChange,
		handleBlur,
		handlePaste,
		handleMenuMouseDown,
		updateHighlights,
		updateCursorPosition,
		handleKeyUp,
		handleDrop,
		handleDragOver,
		handleDragLeave,
		handleTextareaRef,
		handleTextareaKeyDown,
		handleHeightChange,
		handleSetImages,
		handleModeChange,
		handleApiConfigChange,
		handleToggleLockApiConfig,
		handleEnhancePrompt,
		moveGoal,
		highlightLayerRef,
		contextMenuContainerRef,
		extensionCommands: commands,
	} = h
	const {
		placeholderText,
		onSelectImages,
		shouldDisableImages,
		isEditMode = false,
		onCancel,
		isStreaming = false,
		onStop,
		onEnqueueMessage,
		onSend,
		goals = [],
		onAddGoal,
		onRemoveGoal,
		onUpdateGoal,
		modeShortcutText,
	} = props
	const {
		listApiConfigMeta,
		pinnedApiConfigs,
		lockApiConfigAcrossModes,
		customModes,
		customModePrompts,
		devtoolEnabled,
		cloudUserInfo,
	} = h
	const { togglePinnedApiConfig } = h

	return (
		<Container className={containerClassName}>
			<GoalsSection
				goals={goals}
				isEditMode={isEditMode}
				onAddGoal={onAddGoal}
				hasContent={hasContent}
				moveGoal={moveGoal}
				onRemoveGoal={onRemoveGoal}
				onUpdateGoal={onUpdateGoal}
				textAreaStore={textAreaStore}
				t={t}
			/>
			{showEditModeGoalInput && <EditModeGoalInput textAreaStore={textAreaStore} onAddGoal={onAddGoal} />}
			<div className={innerDivClassName}>
				<TextareaWithHighlight
					highlightLayerRef={highlightLayerRef}
					contextMenuContainerRef={contextMenuContainerRef}
					contextMenuClassName={contextMenuClassName}
					borderStyle={borderStyle}
					editModePadding={editModePadding}
					draggingBackground={draggingBackground}
					handleTextareaRef={handleTextareaRef}
					handleInputChange={handleInputChange}
					updateHighlights={updateHighlights}
					handleTextareaKeyDown={handleTextareaKeyDown}
					handleKeyUp={handleKeyUp}
					handleBlur={handleBlur}
					handlePaste={handlePaste}
					updateCursorPosition={updateCursorPosition}
					handleHeightChange={handleHeightChange}
					handleSetImages={handleSetImages}
					handleEnhancePrompt={handleEnhancePrompt}
					isEnhancingPrompt={textAreaStore.isEnhancingPrompt}
					textAreaStore={textAreaStore}
					showContextMenu={showContextMenu}
					showThumbnails={showThumbnails}
					queryItems={queryItems}
					allModes={allModes}
					commands={commands}
					placeholderText={placeholderText}
					isEditMode={isEditMode}
					isStreaming={isStreaming}
					shouldDisableImages={shouldDisableImages}
					hasContent={hasContent}
					hasTextInput={hasTextInput}
					onSelectImages={onSelectImages}
					onCancel={onCancel}
					onEnqueueMessage={onEnqueueMessage}
					sendKeyCombination={sendKeyCombination}
					isSendVisible={isSendVisible}
					onSend={onSend}
					onStop={onStop}
					t={t}
					placeholderBottomText={placeholderBottomText}
					handleMenuMouseDown={handleMenuMouseDown}
					handleMentionSelect={handleMentionSelect}
					handleDrop={handleDrop}
					handleDragOver={handleDragOver}
					handleDragLeave={handleDragLeave}
				/>
			</div>
			<BottomToolbar
				mode={mode}
				handleModeChange={handleModeChange}
				currentConfigId={currentConfigId}
				displayName={displayName}
				sendingDisabled={textAreaStore.sendingDisabled}
				handleApiConfigChange={handleApiConfigChange}
				listApiConfigMeta={listApiConfigMeta}
				pinnedApiConfigs={pinnedApiConfigs}
				togglePinnedApiConfig={togglePinnedApiConfig}
				lockApiConfigAcrossModes={!!lockApiConfigAcrossModes}
				handleToggleLockApiConfig={handleToggleLockApiConfig}
				customModes={customModes}
				customModePrompts={customModePrompts}
				modeShortcutText={modeShortcutText}
				devtoolEnabled={devtoolEnabled}
				toggleDevtool={rootStore.settings.toggleDevtool}
				isTtsPlaying={textAreaStore.isTtsPlaying}
				stopTts={rootStore.chat.stopTts}
				isEditMode={isEditMode}
				cloudUserInfo={cloudUserInfo}
				t={t}
			/>
		</Container>
	)
})

export const DndTextArea = observer(DndTextAreaComponent)
