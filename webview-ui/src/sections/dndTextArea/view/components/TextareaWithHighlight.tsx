import React from "react"
import type { ModeConfig, Command } from "@jabberwock/types"
import type { ContextMenuQueryItem, ContextMenuOptionType } from "../../utils/context-mentions/context-mention-types"
import DynamicTextAreaLib from "react-textarea-autosize"
import { getSnapshot } from "mobx-state-tree"
import { cn } from "@src/lib/utils"
import { Container } from "@src/shared/ui/layouts/Container"
import Thumbnails from "@src/features/foundation/components/ui/display/Thumbnails"
import ContextMenu from "../../mention/context-menu"
import { TEXTAREA_MIN_ROWS, TEXTAREA_MAX_ROWS } from "../constants"
import { ActionButtons } from "./ActionButtons"
import { PlaceholderBottom } from "./PlaceholderBottom"
import type { IDynamicTextAreaStore } from "../../store"

interface TextareaWithHighlightProps {
	highlightLayerRef: React.RefObject<HTMLDivElement | null>
	contextMenuContainerRef: React.RefObject<HTMLDivElement | null>
	contextMenuClassName: string
	borderStyle: string
	editModePadding: string
	draggingBackground: string
	handleTextareaRef: (el: HTMLTextAreaElement | null) => void
	handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
	updateHighlights: () => void
	handleTextareaKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
	handleKeyUp: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
	handleBlur: () => void
	handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
	updateCursorPosition: () => void
	handleHeightChange: (height: number) => void
	handleSetImages: (valueOrCallback: string[] | ((prev: string[]) => string[])) => void
	handleEnhancePrompt: () => void
	isEnhancingPrompt: boolean
	textAreaStore: IDynamicTextAreaStore
	showContextMenu: boolean
	showThumbnails: boolean
	queryItems: ContextMenuQueryItem[]
	allModes: ModeConfig[]
	commands: Command[]
	placeholderText: string
	isEditMode: boolean
	isStreaming: boolean
	shouldDisableImages: boolean
	hasContent: boolean
	hasTextInput: boolean
	onSelectImages: () => void
	onCancel?: () => void
	onEnqueueMessage?: () => void
	sendKeyCombination: string
	isSendVisible: boolean
	onSend: () => void
	onStop?: () => void
	t: (key: string) => string
	placeholderBottomText: string
	handleMenuMouseDown: () => void
	handleMentionSelect: (type: ContextMenuOptionType, value?: string) => void
	handleDrop: (e: React.DragEvent<HTMLDivElement>) => void
	handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void
	handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => void
}

export const TextareaWithHighlight = ({
	highlightLayerRef,
	contextMenuContainerRef,
	contextMenuClassName,
	borderStyle,
	editModePadding,
	draggingBackground,
	handleTextareaRef,
	handleInputChange,
	updateHighlights,
	handleTextareaKeyDown,
	handleKeyUp,
	handleBlur,
	handlePaste,
	updateCursorPosition,
	handleHeightChange,
	handleSetImages,
	handleEnhancePrompt,
	isEnhancingPrompt,
	textAreaStore,
	showContextMenu,
	showThumbnails,
	queryItems,
	allModes,
	commands,
	placeholderText,
	isEditMode,
	isStreaming,
	shouldDisableImages,
	hasContent,
	hasTextInput,
	onSelectImages,
	onCancel,
	onEnqueueMessage,
	sendKeyCombination,
	isSendVisible,
	onSend,
	onStop,
	t,
	placeholderBottomText,
	handleMenuMouseDown,
	handleMentionSelect,
	handleDrop,
	handleDragOver,
	handleDragLeave,
}: TextareaWithHighlightProps) => (
	<div onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
		{showContextMenu && (
			<Container
				ref={contextMenuContainerRef as React.RefObject<HTMLDivElement>}
				className={contextMenuClassName}>
				<ContextMenu
					onSelect={handleMentionSelect}
					searchQuery={textAreaStore.searchQuery}
					inputValue={textAreaStore.inputValue}
					onMouseDown={handleMenuMouseDown}
					selectedIndex={textAreaStore.selectedMenuIndex}
					setSelectedIndex={textAreaStore.setSelectedMenuIndex}
					selectedType={textAreaStore.selectedType}
					queryItems={queryItems}
					modes={allModes}
					loading={textAreaStore.searchLoading}
					dynamicSearchResults={getSnapshot(textAreaStore.fileSearchResults)}
					commands={commands}
				/>
			</Container>
		)}
		<Container className="relative flex-1 flex flex-col-reverse min-h-0 overflow-hidden rounded-lg">
			<div
				ref={highlightLayerRef as React.RefObject<HTMLDivElement>}
				data-testid="highlight-layer"
				className={cn(
					"absolute inset-0 pointer-events-none whitespace-pre-wrap break-words text-transparent overflow-hidden",
					"font-vscode-font-family text-vscode-editor-font-size leading-vscode-editor-line-height",
					borderStyle,
					"pl-2 py-2",
					editModePadding,
					"z-10 forced-color-adjust-none rounded-lg",
				)}
				style={{ color: "transparent" }}
			/>
			<DynamicTextAreaLib
				data-agent-action="chat-input"
				data-testid="chat-input"
				ref={handleTextareaRef}
				value={textAreaStore.inputValue}
				onChange={(e) => {
					handleInputChange(e)
					updateHighlights()
				}}
				onFocus={() => textAreaStore.setIsFocused(true)}
				onKeyDown={handleTextareaKeyDown}
				onKeyUp={handleKeyUp}
				onBlur={handleBlur}
				onPaste={handlePaste}
				onSelect={updateCursorPosition}
				onMouseUp={updateCursorPosition}
				onHeightChange={handleHeightChange}
				placeholder={placeholderText}
				minRows={TEXTAREA_MIN_ROWS}
				maxRows={TEXTAREA_MAX_ROWS}
				autoFocus={true}
				className={cn(
					"w-full text-vscode-input-foreground font-vscode-font-family text-vscode-editor-font-size",
					"leading-vscode-editor-line-height cursor-text py-2 pl-2",
					borderStyle,
					draggingBackground,
					"transition-background-color duration-150 ease-in-out will-change-background-color",
					"min-h-[94px] box-border rounded resize-none overflow-x-hidden overflow-y-auto",
					editModePadding,
					"flex-none flex-grow z-[2] scrollbar-none scrollbar-hide",
				)}
				onScroll={() => updateHighlights()}
			/>
			<ActionButtons
				isEditMode={isEditMode}
				isStreaming={isStreaming}
				shouldDisableImages={shouldDisableImages}
				hasContent={hasContent}
				hasTextInput={hasTextInput}
				onSelectImages={onSelectImages}
				onCancel={onCancel}
				handleEnhancePrompt={handleEnhancePrompt}
				isEnhancingPrompt={isEnhancingPrompt}
				onEnqueueMessage={onEnqueueMessage}
				sendKeyCombination={sendKeyCombination}
				isSendVisible={isSendVisible}
				onSend={onSend}
				onStop={onStop}
				t={t}
			/>
			<PlaceholderBottom
				isEditMode={isEditMode}
				hasInputValue={!!textAreaStore.inputValue}
				placeholderBottomText={placeholderBottomText}
			/>
		</Container>
		{showThumbnails && (
			<Thumbnails
				images={textAreaStore.selectedImages}
				setImages={handleSetImages}
				style={{ left: "16px", zIndex: 2, marginBottom: 0 }}
			/>
		)}
	</div>
)
