import React, { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { observer } from "mobx-react-lite"
import { getSnapshot } from "mobx-state-tree"
import { useEvent } from "react-use"
import DynamicTextAreaLib from "react-textarea-autosize"
import { VolumeX, Image, WandSparkles, SendHorizontal, X, ListEnd, Square, Activity } from "lucide-react"

import type { ExtensionMessage } from "@jabberwock/types"
import { mentionRegex, unescapeSpaces } from "@shared/context-mentions"

import { Mode, getAllModes } from "@shared/modes"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { rootStore } from "@src/features/store"
import { useChatUI } from "@src/features/chat/store"
import {
	ContextMenuOptionType,
	type ContextMenuQueryItem as _ContextMenuQueryItem,
	type SearchResult as _SearchResult,
	insertMention,
	removeMention,
	shouldShowContextMenu,
} from "@src/features/chat/text-area/utils/context-mentions"
import { cn } from "@src/lib/utils"
import { StandardTooltip } from "@src/features/foundation/ui/standard-tooltip"
import { Button } from "@src/features/foundation/ui/button"
import { Container } from "@src/features/foundation/ui/Container"

import Thumbnails from "@src/features/foundation/components/Thumbnails"
import { ModeSelector } from "@src/features/settings/agents/mode-selector/mode-selector"
import { ApiConfigSelector } from "@src/features/settings/agents/api-config/api-config-selector"
import { AutoApproveDropdown } from "@src/features/settings/agents/auto-approve/auto-approve-dropdown"
import ContextMenu from "./mention/context-menu"
import { IndexingStatusBadge } from "@src/features/settings/agents/indexing/indexing-status-badge"
import { usePromptHistory } from "@src/features/chat/text-area/hooks/use-prompt-history"
import { CloudAccountSwitcher } from "@src/features/cloud/components/CloudAccountSwitcher"

import {
	isUrl,
	insertUrlAtCursor,
	buildHighlightHtml,
	syncHighlightScroll,
	extractImagesFromClipboard,
	extractImagesFromFiles,
	processDroppedText,
	getNextSelectableIndex,
	getSelectedOption,
	shouldSendOnEnter,
	generateSearchRequestId,
} from "./utils"

interface DynamicTextAreaProps {
	placeholderText: string
	onSend: () => void
	onSelectImages: () => void
	shouldDisableImages: boolean
	onHeightChange?: (height: number) => void
	modeShortcutText: string
	// Edit mode props
	isEditMode?: boolean
	onCancel?: () => void
	// Stop/Queue functionality
	isStreaming?: boolean
	onStop?: () => void
	onEnqueueMessage?: () => void
}

const DynamicTextAreaComponent = forwardRef<HTMLTextAreaElement, DynamicTextAreaProps>(
	(
		{
			placeholderText,
			onSend,
			onSelectImages,
			shouldDisableImages,
			onHeightChange,
			modeShortcutText,
			isEditMode = false,
			onCancel,
			isStreaming = false,
			onStop,
			onEnqueueMessage,
		},
		ref,
	) => {
		const { t } = useAppTranslation()
		const ui = useChatUI()
		const filePaths = rootStore.filePaths
		const openedTabs = rootStore.openedTabs
		const currentApiConfigName = rootStore.extensionState.currentApiConfigName
		const listApiConfigMeta = rootStore.extensionState.listApiConfigMeta
		const customModes = rootStore.extensionState.customModes
		const customModePrompts = rootStore.extensionState.customModePrompts
		const cwd = rootStore.extensionState.cwd
		const pinnedApiConfigs = rootStore.extensionState.pinnedApiConfigs
		const togglePinnedApiConfig = rootStore.togglePinnedApiConfig
		const taskHistory = rootStore.extensionState.taskHistory
		const messages = rootStore.extensionState.messages
		const commands = rootStore.extensionCommands
		const cloudUserInfo = rootStore.extensionState.cloudUserInfo
		const enterBehavior = rootStore.extensionState.enterBehavior
		const lockApiConfigAcrossModes = rootStore.extensionState.lockApiConfigAcrossModes
		const devtoolEnabled = rootStore.extensionState.devtoolEnabled
		const mode = rootStore.extensionState.mode
		const setMode = rootStore.setMode

		// Find the ID and display text for the currently selected API configuration.
		const textAreaStore = rootStore.chat.textArea

		const { currentConfigId, displayName } = useMemo(() => {
			const currentConfig = listApiConfigMeta?.find((config) => config.name === currentApiConfigName)
			return {
				currentConfigId: currentConfig?.id || "",
				displayName: currentApiConfigName || "",
			}
		}, [listApiConfigMeta, currentApiConfigName])

		// State migrated to textAreaStore
		const textAreaRef = useRef<HTMLTextAreaElement | null>(null)

		// Close dropdown when clicking outside.
		useEffect(() => {
			const handleClickOutside = () => {
				if (textAreaStore.showDropdown) {
					textAreaStore.setShowDropdown(false)
				}
			}

			document.addEventListener("mousedown", handleClickOutside)
			return () => document.removeEventListener("mousedown", handleClickOutside)
		}, [textAreaStore.showDropdown, textAreaStore])

		// Handle enhanced prompt response and search results.
		useEffect(() => {
			const messageHandler = (event: MessageEvent) => {
				const message = event.data

				if (message.type === "enhancedPrompt") {
					if (message.text && textAreaRef.current) {
						try {
							if (document.execCommand) {
								const textarea = textAreaRef.current
								textarea.focus()
								textarea.select()
								document.execCommand("insertText", false, message.text)
							} else {
								ui.setInputValue(message.text)
							}
						} catch {
							ui.setInputValue(message.text)
						}
					}

					textAreaStore.setIsEnhancingPrompt(false)
				} else if (message.type === "insertTextIntoTextarea") {
					if (message.text && textAreaRef.current) {
						const textarea = textAreaRef.current
						const currentValue = ui.inputValue
						const cursorPos = textarea.selectionStart || 0

						const textBefore = currentValue.slice(0, cursorPos)
						const needsSpaceBefore = textBefore.length > 0 && !textBefore.endsWith(" ")
						const prefix = needsSpaceBefore ? " " : ""

						const newValue =
							currentValue.slice(0, cursorPos) +
							prefix +
							message.text +
							" " +
							currentValue.slice(cursorPos)
						ui.setInputValue(newValue)

						const newCursorPos = cursorPos + prefix.length + message.text.length + 1
						setTimeout(() => {
							if (textAreaRef.current) {
								textAreaRef.current.focus()
								textAreaRef.current.setSelectionRange(newCursorPos, newCursorPos)
							}
						}, 0)
					}
				} else if (message.type === "commitSearchResults") {
					const commits = message.commits.map(
						(commit: {
							hash: string
							subject: string
							shortHash: string
							author: string
							date: string
						}) => ({
							type: ContextMenuOptionType.Git,
							value: commit.hash,
							label: commit.subject,
							description: `${commit.shortHash} by ${commit.author} on ${commit.date}`,
							icon: "$(git-commit)",
						}),
					)

					textAreaStore.setGitCommits(commits)
				} else if (message.type === "fileSearchResults") {
					textAreaStore.setSearchLoading(false)
					if (message.requestId === textAreaStore.searchRequestId) {
						textAreaStore.setFileSearchResults(message.results || [])
					}
				}
			}

			window.addEventListener("message", messageHandler)
			return () => window.removeEventListener("message", messageHandler)
		}, [ui, textAreaStore.searchRequestId, textAreaStore])

		const highlightLayerRef = useRef<HTMLDivElement>(null)
		const contextMenuContainerRef = useRef<HTMLDivElement>(null)

		// Use custom hook for prompt history navigation
		const { handleHistoryNavigation, resetHistoryNavigation, resetOnInputChange } = usePromptHistory({
			messages,
			taskHistory,
			cwd,
			inputValue: ui.inputValue,
			setInputValue: ui.setInputValue,
		})

		// Fetch git commits when Git is selected or when typing a hash.
		useEffect(() => {
			if (
				textAreaStore.selectedType === ContextMenuOptionType.Git ||
				/^[a-f0-9]+$/i.test(textAreaStore.searchQuery)
			) {
				rootStore.history.searchCommits(textAreaStore.searchQuery || "")
			}
		}, [textAreaStore.selectedType, textAreaStore.searchQuery])

		const handleEnhancePrompt = useCallback(() => {
			const trimmedInput = ui.inputValue.trim()

			if (trimmedInput) {
				textAreaStore.setIsEnhancingPrompt(true)
				rootStore.chat.enhancePrompt(trimmedInput)
			} else {
				ui.setInputValue(t("chat:enhancePromptDescription"))
			}
		}, [ui, t, textAreaStore])

		const allModes = useMemo(() => getAllModes(customModes), [customModes])

		// Check for whether the input has content (text or images)
		const hasInputContent = ui.inputValue.trim().length > 0 || ui.selectedImages.length > 0

		// Compute the key combination text for the send button tooltip based on enterBehavior
		const sendKeyCombination = useMemo(() => {
			if (enterBehavior === "newline") {
				const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
				return isMac ? "⌘+Enter" : "Ctrl+Enter"
			}
			return "Enter"
		}, [enterBehavior])

		const queryItems = useMemo(() => {
			const gitCommits = getSnapshot(textAreaStore.gitCommits)
			return [
				{ type: ContextMenuOptionType.Problems, value: "problems" },
				{ type: ContextMenuOptionType.Terminal, value: "terminal" },
				...gitCommits,
				...(openedTabs || [])
					.filter((tab) => tab.path)
					.map((tab) => ({
						type: ContextMenuOptionType.OpenedFile,
						value: "/" + tab.path,
					})),
				...(filePaths || [])
					.map((file) => "/" + file)
					.filter((path) => !(openedTabs || []).some((tab) => tab.path && "/" + tab.path === path))
					.map((path) => ({
						type: path.endsWith("/") ? ContextMenuOptionType.Folder : ContextMenuOptionType.File,
						value: path,
					})),
			]
		}, [filePaths, textAreaStore.gitCommits, openedTabs])

		useEffect(() => {
			const handleClickOutside = (event: MouseEvent) => {
				if (
					contextMenuContainerRef.current &&
					!contextMenuContainerRef.current.contains(event.target as Node)
				) {
					textAreaStore.setShowContextMenu(false)
				}
			}

			if (textAreaStore.showContextMenu) {
				document.addEventListener("mousedown", handleClickOutside)
			}

			return () => {
				document.removeEventListener("mousedown", handleClickOutside)
			}
		}, [textAreaStore.showContextMenu, textAreaStore.setShowContextMenu, textAreaStore])

		const handleMentionSelect = useCallback(
			(type: ContextMenuOptionType, value?: string) => {
				if (type === ContextMenuOptionType.NoResults) {
					return
				}

				if (type === ContextMenuOptionType.Mode && value) {
					setMode(value)
					ui.setInputValue("")
					textAreaStore.setShowContextMenu(false)
					rootStore.chat.switchMode(value)
					return
				}

				if (type === ContextMenuOptionType.Command && value) {
					textAreaStore.setSelectedMenuIndex(-1)
					ui.setInputValue("")
					textAreaStore.setShowContextMenu(false)

					const commandMention = `/${value}`
					ui.setInputValue(commandMention + " ")
					textAreaStore.setCursorPosition(commandMention.length + 1)
					textAreaStore.setIntendedCursorPosition(commandMention.length + 1)

					setTimeout(() => {
						if (textAreaRef.current) {
							textAreaRef.current.focus()
						}
					}, 0)
					return
				}

				if (
					type === ContextMenuOptionType.File ||
					type === ContextMenuOptionType.Folder ||
					type === ContextMenuOptionType.Git
				) {
					if (!value) {
						textAreaStore.setSelectedType(type)
						textAreaStore.setSearchQuery("")
						textAreaStore.setSelectedMenuIndex(0)
						return
					}
				}

				textAreaStore.setShowContextMenu(false)
				textAreaStore.setSelectedType(ContextMenuOptionType.None)

				if (textAreaRef.current) {
					let insertValue = value || ""

					if (type === ContextMenuOptionType.URL) {
						insertValue = value || ""
					} else if (type === ContextMenuOptionType.File || type === ContextMenuOptionType.Folder) {
						insertValue = value || ""
					} else if (type === ContextMenuOptionType.Problems) {
						insertValue = "problems"
					} else if (type === ContextMenuOptionType.Terminal) {
						insertValue = "terminal"
					} else if (type === ContextMenuOptionType.Git) {
						insertValue = value || ""
					} else if (type === ContextMenuOptionType.Command) {
						insertValue = value ? `/${value}` : ""
					}

					const isSlashCommand = type === ContextMenuOptionType.Mode || type === ContextMenuOptionType.Command

					const { newValue, mentionIndex } = insertMention(
						textAreaRef.current.value,
						textAreaStore.cursorPosition,
						insertValue,
						isSlashCommand,
					)

					ui.setInputValue(newValue)
					const newCursorPosition = newValue.indexOf(" ", mentionIndex + insertValue.length) + 1
					textAreaStore.setCursorPosition(newCursorPosition)
					textAreaStore.setIntendedCursorPosition(newCursorPosition)

					setTimeout(() => {
						if (textAreaRef.current) {
							textAreaRef.current.blur()
							textAreaRef.current.focus()
						}
					}, 0)
				}
			},
			// eslint-disable-next-line react-hooks/exhaustive-deps
			[ui, textAreaStore.cursorPosition],
		)

		const handleKeyDown = useCallback(
			(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
				if (textAreaStore.showContextMenu) {
					if (event.key === "Escape") {
						textAreaStore.setSelectedType(ContextMenuOptionType.None)
						textAreaStore.setSelectedMenuIndex(3)
						return
					}

					if (event.key === "ArrowUp" || event.key === "ArrowDown") {
						event.preventDefault()
						const direction = event.key === "ArrowUp" ? -1 : 1
						textAreaStore.setSelectedMenuIndex(
							getNextSelectableIndex(
								textAreaStore.selectedMenuIndex,
								direction,
								textAreaStore.searchQuery,
								textAreaStore.selectedType,
								queryItems,
								getSnapshot(textAreaStore.fileSearchResults),
								allModes,
								commands,
							),
						)
						return
					}
					if ((event.key === "Enter" || event.key === "Tab") && textAreaStore.selectedMenuIndex !== -1) {
						event.preventDefault()
						const selectedOption = getSelectedOption(
							textAreaStore.selectedMenuIndex,
							textAreaStore.searchQuery,
							textAreaStore.selectedType,
							queryItems,
							getSnapshot(textAreaStore.fileSearchResults),
							allModes,
							commands,
						)
						if (
							selectedOption &&
							selectedOption.type !== ContextMenuOptionType.URL &&
							selectedOption.type !== ContextMenuOptionType.NoResults &&
							selectedOption.type !== ContextMenuOptionType.SectionHeader
						) {
							handleMentionSelect(selectedOption.type, selectedOption.value)
						}
						return
					}
				}

				const isComposing = event.nativeEvent?.isComposing ?? false

				if (handleHistoryNavigation(event, textAreaStore.showContextMenu, isComposing)) {
					return
				}

				if (shouldSendOnEnter(event, enterBehavior, isComposing)) {
					event.preventDefault()
					resetHistoryNavigation()
					onSend()
				}

				if (event.key === "Backspace" && !isComposing) {
					const charBeforeCursor = ui.inputValue[textAreaStore.cursorPosition - 1]
					const charAfterCursor = ui.inputValue[textAreaStore.cursorPosition + 1]

					const charBeforeIsWhitespace =
						charBeforeCursor === " " || charBeforeCursor === "\n" || charBeforeCursor === "\r\n"

					const charAfterIsWhitespace =
						charAfterCursor === " " || charAfterCursor === "\n" || charAfterCursor === "\r\n"

					if (
						charBeforeIsWhitespace &&
						ui.inputValue
							.slice(0, textAreaStore.cursorPosition - 1)
							.match(new RegExp(mentionRegex.source + "$"))
					) {
						const newCursorPosition = textAreaStore.cursorPosition - 1
						if (!charAfterIsWhitespace) {
							event.preventDefault()
							textAreaRef.current?.setSelectionRange(newCursorPosition, newCursorPosition)
							textAreaStore.setCursorPosition(newCursorPosition)
						}

						textAreaStore.setCursorPosition(newCursorPosition)
						textAreaStore.setJustDeletedSpaceAfterMention(true)
					} else if (textAreaStore.justDeletedSpaceAfterMention) {
						const { newText, newPosition } = removeMention(ui.inputValue, textAreaStore.cursorPosition)

						if (newText !== ui.inputValue) {
							event.preventDefault()
							ui.setInputValue(newText)
							textAreaStore.setIntendedCursorPosition(newPosition)
						}

						textAreaStore.setJustDeletedSpaceAfterMention(false)
						textAreaStore.setShowContextMenu(false)
					} else {
						textAreaStore.setJustDeletedSpaceAfterMention(false)
					}
				}
			},
			[
				onSend,
				handleMentionSelect,
				ui,
				queryItems,
				allModes,
				handleHistoryNavigation,
				resetHistoryNavigation,
				commands,
				enterBehavior,
				textAreaStore,
			],
		)

		useLayoutEffect(() => {
			if (textAreaStore.intendedCursorPosition !== -1 && textAreaRef.current) {
				textAreaRef.current.setSelectionRange(
					textAreaStore.intendedCursorPosition,
					textAreaStore.intendedCursorPosition,
				)
				textAreaStore.setIntendedCursorPosition(-1)
			}
		}, [ui, textAreaStore.intendedCursorPosition, textAreaStore])

		const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

		const handleInputChange = useCallback(
			(e: React.ChangeEvent<HTMLTextAreaElement>) => {
				const newValue = e.target.value
				ui.setInputValue(newValue)

				resetOnInputChange()

				const newCursorPosition = e.target.selectionStart
				textAreaStore.setCursorPosition(newCursorPosition)

				const showMenu = shouldShowContextMenu(newValue, newCursorPosition)
				textAreaStore.setShowContextMenu(showMenu)

				if (showMenu) {
					if (newValue.startsWith("/") && !newValue.includes(" ")) {
						const query = newValue
						textAreaStore.setSearchQuery(query)
						textAreaStore.setSelectedMenuIndex(1)
						rootStore.chat.requestCommands()
					} else {
						const lastAtIndex = newValue.lastIndexOf("@", newCursorPosition - 1)
						const query = newValue.slice(lastAtIndex + 1, newCursorPosition)
						textAreaStore.setSearchQuery(query)

						if (query.length > 0) {
							textAreaStore.setSelectedMenuIndex(0)

							if (searchTimeoutRef.current) {
								clearTimeout(searchTimeoutRef.current)
							}

							searchTimeoutRef.current = setTimeout(() => {
								const reqId = generateSearchRequestId()
								textAreaStore.setSearchRequestId(reqId)
								textAreaStore.setSearchLoading(true)

								rootStore.chat.searchFiles(unescapeSpaces(query), reqId)
							}, 200)
						} else {
							textAreaStore.setSelectedMenuIndex(3)
						}
					}
				} else {
					textAreaStore.setSearchQuery("")
					textAreaStore.setSelectedMenuIndex(-1)
					textAreaStore.setFileSearchResults([])
				}
			},
			[ui, resetOnInputChange, textAreaStore],
		)

		useEffect(() => {
			if (!textAreaStore.showContextMenu) {
				textAreaStore.setSelectedType(ContextMenuOptionType.None)
			}
		}, [textAreaStore.showContextMenu, textAreaStore])

		const handleBlur = useCallback(() => {
			if (!textAreaStore.isMouseDownOnMenu) {
				textAreaStore.setShowContextMenu(false)
			}

			textAreaStore.setIsFocused(false)
		}, [textAreaStore])

		const handlePaste = useCallback(
			async (e: React.ClipboardEvent) => {
				const pastedText = e.clipboardData.getData("text")

				if (isUrl(pastedText)) {
					e.preventDefault()
					const { newValue, newCursorPosition } = insertUrlAtCursor(
						ui.inputValue,
						textAreaStore.cursorPosition,
						pastedText,
					)
					ui.setInputValue(newValue)
					textAreaStore.setCursorPosition(newCursorPosition)
					textAreaStore.setIntendedCursorPosition(newCursorPosition)
					textAreaStore.setShowContextMenu(false)

					setTimeout(() => {
						if (textAreaRef.current) {
							textAreaRef.current.blur()
							textAreaRef.current.focus()
						}
					}, 0)
					return
				}

				if (!shouldDisableImages) {
					const dataUrls = await extractImagesFromClipboard(e.clipboardData.items, ui.selectedImages.length)
					if (dataUrls.length > 0) {
						e.preventDefault()
						ui.appendSelectedImages(dataUrls)
						return
					}
				}
			},
			[shouldDisableImages, ui, textAreaStore],
		)

		const handleMenuMouseDown = useCallback(() => {
			textAreaStore.setIsMouseDownOnMenu(true)
		}, [textAreaStore])

		const updateHighlights = useCallback(() => {
			if (!textAreaRef.current || !highlightLayerRef.current) return

			const html = buildHighlightHtml(textAreaRef.current.value, commands || [])
			highlightLayerRef.current.innerHTML = html
			syncHighlightScroll(textAreaRef.current, highlightLayerRef.current)
		}, [commands])

		useLayoutEffect(() => {
			updateHighlights()
		}, [ui, updateHighlights])

		const updateCursorPosition = useCallback(() => {
			if (textAreaRef.current) {
				textAreaStore.setCursorPosition(textAreaRef.current.selectionStart)
			}
		}, [textAreaStore])

		const handleKeyUp = useCallback(
			(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
				if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
					updateCursorPosition()
				}
			},
			[updateCursorPosition],
		)

		const handleDrop = useCallback(
			async (e: React.DragEvent<HTMLDivElement>) => {
				e.preventDefault()
				textAreaStore.setIsDraggingOver(false)

				const textFieldList = e.dataTransfer.getData("text")
				const textUriList = e.dataTransfer.getData("application/vnd.code.uri-list")
				const text = textFieldList || textUriList

				if (text) {
					const { newValue, newCursorPosition } = processDroppedText(
						text,
						ui.inputValue,
						textAreaStore.cursorPosition,
						cwd,
					)
					if (newValue !== ui.inputValue) {
						ui.setInputValue(newValue)
						textAreaStore.setCursorPosition(newCursorPosition)
						textAreaStore.setIntendedCursorPosition(newCursorPosition)
					}
					return
				}

				if (!shouldDisableImages && e.dataTransfer.files.length > 0) {
					const dataUrls = await extractImagesFromFiles(e.dataTransfer.files, ui.selectedImages.length)
					if (dataUrls.length > 0) {
						ui.appendSelectedImages(dataUrls)
						rootStore.chat.draggedImages(dataUrls)
					}
				}
			},
			[cwd, ui, shouldDisableImages, textAreaStore],
		)

		// isTtsPlaying in textAreaStore

		useEvent("message", (event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			if (message.type === "ttsStart") {
				textAreaStore.setIsTtsPlaying(true)
			} else if (message.type === "ttsStop") {
				textAreaStore.setIsTtsPlaying(false)
			}
		})

		const placeholderBottomText = `\n(${t("chat:addContext")}${shouldDisableImages ? `, ${t("chat:dragFiles")}` : `, ${t("chat:dragFilesImages")}`})`

		// Common mode selector handler
		const handleModeChange = useCallback(
			(value: Mode) => {
				setMode(value)
				rootStore.chat.switchMode(value)
			},
			[setMode],
		)

		const handleApiConfigChange = useCallback((value: string) => {
			rootStore.settings.loadApiConfigById(value)
		}, [])

		const handleToggleLockApiConfig = useCallback(() => {
			const newValue = !lockApiConfigAcrossModes
			rootStore.settings.lockApiConfigAcrossModes(newValue)
		}, [lockApiConfigAcrossModes])

		return (
			<Container
				className={cn(
					"flex flex-col gap-1 bg-editor-background outline-none border border-none box-border",
					isEditMode ? "p-2 w-full" : "relative px-1.5 pb-1 w-[calc(100%-16px)] ml-auto mr-auto",
				)}>
				<div className={cn(!isEditMode && "relative")}>
					<div
						className={cn("chat-text-area", !isEditMode && "relative", "flex", "flex-col", "outline-none")}
						onDrop={handleDrop}
						onDragOver={(e) => {
							if (!e.shiftKey) {
								textAreaStore.setIsDraggingOver(false)
								return
							}

							e.preventDefault()
							textAreaStore.setIsDraggingOver(true)
							e.dataTransfer.dropEffect = "copy"
						}}
						onDragLeave={(e) => {
							e.preventDefault()
							const rect = e.currentTarget.getBoundingClientRect()

							if (
								e.clientX <= rect.left ||
								e.clientX >= rect.right ||
								e.clientY <= rect.top ||
								e.clientY >= rect.bottom
							) {
								textAreaStore.setIsDraggingOver(false)
							}
						}}>
						{textAreaStore.showContextMenu && (
							<Container
								ref={contextMenuContainerRef}
								className={cn(
									"absolute",
									"bottom-full",
									isEditMode ? "left-6" : "left-0",
									"right-0",
									"z-[1000]",
									isEditMode ? "-mb-3" : "mb-2",
									"filter",
									"drop-shadow-md",
								)}>
								<ContextMenu
									onSelect={handleMentionSelect}
									searchQuery={textAreaStore.searchQuery}
									inputValue={ui.inputValue}
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

						<Container
							className={cn(
								"relative",
								"flex-1",
								"flex",
								"flex-col-reverse",
								"min-h-0",
								"overflow-hidden",
								"rounded-lg",
							)}>
							<div
								ref={highlightLayerRef}
								data-testid="highlight-layer"
								className={cn(
									"absolute",
									"inset-0",
									"pointer-events-none",
									"whitespace-pre-wrap",
									"break-words",
									"text-transparent",
									"overflow-hidden",
									"font-vscode-font-family",
									"text-vscode-editor-font-size",
									"leading-vscode-editor-line-height",
									textAreaStore.isFocused
										? "border border-vscode-focusBorder outline outline-vscode-focusBorder"
										: textAreaStore.isDraggingOver
											? "border-2 border-dashed border-vscode-focusBorder"
											: "border border-transparent",
									"pl-2",
									"py-2",
									isEditMode ? "pr-20" : "pr-9",
									"z-10",
									"forced-color-adjust-none",
									"rounded-lg",
								)}
								style={{
									color: "transparent",
								}}
							/>
							<DynamicTextAreaLib
								data-agent-action="chat-input"
								data-testid="chat-input"
								ref={(el) => {
									if (typeof ref === "function") {
										ref(el)
									} else if (ref) {
										ref.current = el
									}
									textAreaRef.current = el
								}}
								value={ui.inputValue}
								onChange={(e) => {
									handleInputChange(e)
									updateHighlights()
								}}
								onFocus={() => textAreaStore.setIsFocused(true)}
								onKeyDown={(e) => {
									if (isEditMode && e.key === "Escape" && !e.nativeEvent?.isComposing) {
										e.preventDefault()
										onCancel?.()
										return
									}
									handleKeyDown(e)
								}}
								onKeyUp={handleKeyUp}
								onBlur={handleBlur}
								onPaste={handlePaste}
								onSelect={updateCursorPosition}
								onMouseUp={updateCursorPosition}
								onHeightChange={(height) => {
									if (
										textAreaStore.textAreaBaseHeight < 0 ||
										height < textAreaStore.textAreaBaseHeight
									) {
										textAreaStore.setTextAreaBaseHeight(height)
									}

									onHeightChange?.(height)
								}}
								placeholder={placeholderText}
								minRows={3}
								maxRows={15}
								autoFocus={true}
								className={cn(
									"w-full",
									"text-vscode-input-foreground",
									"font-vscode-font-family",
									"text-vscode-editor-font-size",
									"leading-vscode-editor-line-height",
									"cursor-text",
									"py-2 pl-2",
									textAreaStore.isFocused
										? "border border-vscode-focusBorder outline outline-vscode-focusBorder"
										: textAreaStore.isDraggingOver
											? "border-2 border-dashed border-vscode-focusBorder"
											: "border border-transparent",
									textAreaStore.isDraggingOver
										? "bg-[color-mix(in_srgb,var(--vscode-input-background)_95%,var(--vscode-focusBorder))]"
										: "bg-vscode-input-background",
									"transition-background-color duration-150 ease-in-out",
									"will-change-background-color",
									"min-h-[94px]",
									"box-border",
									"rounded",
									"resize-none",
									"overflow-x-hidden",
									"overflow-y-auto",
									isEditMode ? "pr-20" : "pr-9",
									"flex-none flex-grow",
									"z-[2]",
									"scrollbar-none",
									"scrollbar-hide",
								)}
								onScroll={() => updateHighlights()}
							/>

							<Container className="absolute bottom-2 right-1 z-30 flex flex-col items-center gap-0">
								<StandardTooltip content={t("chat:addImages")}>
									<Button
										variant={shouldDisableImages ? "iconButtonDisabled" : "iconButtonMuted"}
										size="icon"
										aria-label={t("chat:addImages")}
										disabled={shouldDisableImages}
										onClick={!shouldDisableImages ? onSelectImages : undefined}>
										<Image className="w-4 h-4" />
									</Button>
								</StandardTooltip>
								{isEditMode ? (
									<StandardTooltip content={t("chat:cancel.title")}>
										<Button
											variant="iconButton"
											size="icon"
											aria-label={t("chat:cancel.title")}
											onClick={onCancel}>
											<X className="w-4 h-4" />
										</Button>
									</StandardTooltip>
								) : (
									<StandardTooltip content={t("chat:enhancePrompt")}>
										<Button
											variant={hasInputContent ? "iconButtonMuted" : "iconButton"}
											size="icon"
											aria-label={t("chat:enhancePrompt")}
											onClick={handleEnhancePrompt}
											className={cn(
												!hasInputContent &&
													"opacity-0 pointer-events-none duration-200 delay-0",
											)}>
											<WandSparkles
												className={cn(
													"w-4 h-4",
													textAreaStore.isEnhancingPrompt && "animate-spin",
												)}
											/>
										</Button>
									</StandardTooltip>
								)}
								{!isEditMode && isStreaming && hasInputContent && onEnqueueMessage && (
									<StandardTooltip content={t("chat:enqueueMessage")}>
										<Button
											variant="iconButton"
											size="icon"
											aria-label={t("chat:enqueueMessage")}
											onClick={onEnqueueMessage}>
											<ListEnd className="w-4 h-4" />
										</Button>
									</StandardTooltip>
								)}
								<StandardTooltip
									content={
										isEditMode
											? t("chat:pressToSend", { keyCombination: sendKeyCombination })
											: isStreaming
												? t("chat:stop.title")
												: t("chat:pressToSend", { keyCombination: sendKeyCombination })
									}>
									<Button
										variant={isStreaming ? "stopButton" : "sendButton"}
										size="icon"
										data-agent-action={isStreaming ? "cancel-task" : "send-message"}
										data-testid="submit-button"
										aria-label={
											isEditMode
												? t("chat:pressToSend", { keyCombination: sendKeyCombination })
												: isStreaming
													? t("chat:stop.title")
													: t("chat:pressToSend", { keyCombination: sendKeyCombination })
										}
										onClick={isStreaming ? onStop : onSend}
										className={cn(
											isEditMode || isStreaming || hasInputContent
												? "opacity-100 pointer-events-auto"
												: "opacity-0 pointer-events-none",
										)}>
										{isStreaming ? (
											<Square className="size-4 stroke-none fill-vscode-button-foreground" />
										) : (
											<SendHorizontal className="size-4" />
										)}
									</Button>
								</StandardTooltip>
							</Container>

							{!ui.inputValue && (
								<Container
									className={cn(
										"absolute left-2 z-30 flex items-center h-8 font-vscode-font-family text-vscode-editor-font-size leading-vscode-editor-line-height",
										isEditMode ? "pr-20" : "pr-9",
									)}
									style={{
										bottom: "0.75rem",
										color: "color-mix(in oklab, var(--vscode-input-foreground) 50%, transparent)",
										userSelect: "none",
										pointerEvents: "none",
									}}>
									{placeholderBottomText}
								</Container>
							)}
						</Container>
					</div>
				</div>

				{ui.selectedImages.length > 0 && (
					<Thumbnails
						images={ui.selectedImages}
						setImages={(valueOrCallback: string[] | ((prev: string[]) => string[])) => {
							if (typeof valueOrCallback === "function") {
								ui.setSelectedImages(valueOrCallback(ui.selectedImages))
							} else {
								ui.setSelectedImages(valueOrCallback)
							}
						}}
						style={{
							left: "16px",
							zIndex: 2,
							marginBottom: 0,
						}}
					/>
				)}

				<Container className="flex items-center gap-2">
					<Container className="flex items-center gap-2 min-w-0 overflow-clip flex-1">
						<ModeSelector
							data-agent-action="mode-select"
							value={mode}
							title={t("chat:selectMode")}
							onChange={handleModeChange}
							triggerClassName="text-ellipsis overflow-hidden flex-shrink-0"
							modeShortcutText={modeShortcutText}
							customModes={customModes}
							customModePrompts={customModePrompts}
						/>
						<ApiConfigSelector
							value={currentConfigId}
							displayName={displayName}
							disabled={ui.sendingDisabled}
							title={t("chat:selectApiConfig")}
							onChange={handleApiConfigChange}
							triggerClassName="min-w-[28px] text-ellipsis overflow-hidden flex-shrink"
							listApiConfigMeta={listApiConfigMeta || []}
							pinnedApiConfigs={pinnedApiConfigs}
							togglePinnedApiConfig={togglePinnedApiConfig}
							lockApiConfigAcrossModes={!!lockApiConfigAcrossModes}
							onToggleLockApiConfig={handleToggleLockApiConfig}
						/>
						<AutoApproveDropdown triggerClassName="min-w-[28px] text-ellipsis overflow-hidden flex-shrink" />
					</Container>
					<Container
						className={cn(
							"flex flex-shrink-0 items-center gap-0.5 h-5 leading-none",
							!isEditMode && cloudUserInfo ? "" : "pr-2",
						)}>
						<StandardTooltip content="Toggle DevTools">
							<Button
								variant="devtoolsButton"
								size="icon"
								aria-label="Toggle DevTools"
								onClick={rootStore.settings.toggleDevtool}
								className={cn(
									devtoolEnabled
										? "text-[#ffaa00] hover:bg-[rgba(255,170,0,0.1)] active:bg-[rgba(255,170,0,0.2)]"
										: "text-vscode-foreground opacity-60 hover:opacity-100 hover:bg-[rgba(255,255,255,0.05)] active:bg-[rgba(255,255,255,0.1)]",
								)}>
								<Activity className="w-4 h-4" />
							</Button>
						</StandardTooltip>
						{textAreaStore.isTtsPlaying && (
							<StandardTooltip content={t("chat:stopTts")}>
								<Button
									variant="iconButton"
									size="icon"
									aria-label={t("chat:stopTts")}
									onClick={rootStore.chat.stopTts}>
									<VolumeX className="w-4 h-4" />
								</Button>
							</StandardTooltip>
						)}
						{!isEditMode ? <IndexingStatusBadge /> : null}
						{!isEditMode && cloudUserInfo && <CloudAccountSwitcher />}
					</Container>
				</Container>
			</Container>
		)
	},
)

export const DynamicTextArea = observer(DynamicTextAreaComponent)
export { DynamicTextArea as ChatTextArea }
