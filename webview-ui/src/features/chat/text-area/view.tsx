import React, { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { useEvent } from "react-use"
import DynamicTextAreaLib from "react-textarea-autosize"
import { VolumeX, Image, WandSparkles, SendHorizontal, X, ListEnd, Square, Activity } from "lucide-react"

import type { ExtensionMessage } from "@jabberwock/types"
import { mentionRegex, unescapeSpaces } from "@shared/context-mentions"
import { WebviewMessage } from "@shared/WebviewMessage"
import { Mode, getAllModes } from "@shared/modes"

import { vscode } from "@jabberwock/devtool/react"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useChatUI } from "@src/features/chat/store"
import {
	ContextMenuOptionType,
	insertMention,
	removeMention,
	shouldShowContextMenu,
	SearchResult,
} from "@src/features/chat/text-area/utils/context-mentions"
import { cn } from "@src/lib/utils"
import { StandardTooltip } from "@src/components/ui/standard-tooltip"
import { Button } from "@src/components/ui/button"
import { Container } from "@src/components/ui/Container"

import Thumbnails from "@src/components/common/Thumbnails"
import { ModeSelector } from "@src/features/foundation/agent-state/mode-selector/mode-selector"
import { ApiConfigSelector } from "@src/features/foundation/agent-state/api-config/api-config-selector"
import { AutoApproveDropdown } from "@src/features/foundation/agent-state/auto-approve/auto-approve-dropdown"
import ContextMenu from "./mention/context-menu"
import { IndexingStatusBadge } from "@src/features/foundation/agent-state/indexing/indexing-status-badge"
import { usePromptHistory } from "@src/features/chat/text-area/hooks/use-prompt-history"
import { CloudAccountSwitcher } from "@src/components/cloud/CloudAccountSwitcher"

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
		const {
			filePaths,
			openedTabs,
			currentApiConfigName,
			listApiConfigMeta,
			customModes,
			customModePrompts,
			cwd,
			pinnedApiConfigs,
			togglePinnedApiConfig,
			taskHistory,
			clineMessages,
			commands,
			cloudUserInfo,
			enterBehavior,
			lockApiConfigAcrossModes,
			devtoolEnabled,
			mode,
			setMode,
		} = useExtensionState()

		// Find the ID and display text for the currently selected API configuration.
		const { currentConfigId, displayName } = useMemo(() => {
			const currentConfig = listApiConfigMeta?.find((config) => config.name === currentApiConfigName)
			return {
				currentConfigId: currentConfig?.id || "",
				displayName: currentApiConfigName || "",
			}
		}, [listApiConfigMeta, currentApiConfigName])

		const [gitCommits, setGitCommits] = useState<any[]>([])
		const [showDropdown, setShowDropdown] = useState(false)
		const [fileSearchResults, setFileSearchResults] = useState<SearchResult[]>([])
		const [searchLoading, setSearchLoading] = useState(false)
		const [searchRequestId, setSearchRequestId] = useState<string>("")

		// Close dropdown when clicking outside.
		useEffect(() => {
			const handleClickOutside = () => {
				if (showDropdown) {
					setShowDropdown(false)
				}
			}

			document.addEventListener("mousedown", handleClickOutside)
			return () => document.removeEventListener("mousedown", handleClickOutside)
		}, [showDropdown])

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

					setIsEnhancingPrompt(false)
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
					const commits = message.commits.map((commit: any) => ({
						type: ContextMenuOptionType.Git,
						value: commit.hash,
						label: commit.subject,
						description: `${commit.shortHash} by ${commit.author} on ${commit.date}`,
						icon: "$(git-commit)",
					}))

					setGitCommits(commits)
				} else if (message.type === "fileSearchResults") {
					setSearchLoading(false)
					if (message.requestId === searchRequestId) {
						setFileSearchResults(message.results || [])
					}
				}
			}

			window.addEventListener("message", messageHandler)
			return () => window.removeEventListener("message", messageHandler)
		}, [ui, searchRequestId])

		const [isDraggingOver, setIsDraggingOver] = useState(false)
		const [textAreaBaseHeight, setTextAreaBaseHeight] = useState<number | undefined>(undefined)
		const [showContextMenu, setShowContextMenu] = useState(false)
		const [cursorPosition, setCursorPosition] = useState(0)
		const [searchQuery, setSearchQuery] = useState("")
		const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
		const [isMouseDownOnMenu, setIsMouseDownOnMenu] = useState(false)
		const highlightLayerRef = useRef<HTMLDivElement>(null)
		const [selectedMenuIndex, setSelectedMenuIndex] = useState(-1)
		const [selectedType, setSelectedType] = useState<ContextMenuOptionType | null>(null)
		const [justDeletedSpaceAfterMention, setJustDeletedSpaceAfterMention] = useState(false)
		const [intendedCursorPosition, setIntendedCursorPosition] = useState<number | null>(null)
		const contextMenuContainerRef = useRef<HTMLDivElement>(null)
		const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false)
		const [isFocused, setIsFocused] = useState(false)

		// Use custom hook for prompt history navigation
		const { handleHistoryNavigation, resetHistoryNavigation, resetOnInputChange } = usePromptHistory({
			clineMessages,
			taskHistory,
			cwd,
			inputValue: ui.inputValue,
			setInputValue: ui.setInputValue,
		})

		// Fetch git commits when Git is selected or when typing a hash.
		useEffect(() => {
			if (selectedType === ContextMenuOptionType.Git || /^[a-f0-9]+$/i.test(searchQuery)) {
				const message: WebviewMessage = {
					type: "searchCommits",
					query: searchQuery || "",
				} as const
				vscode.postMessage(message)
			}
		}, [selectedType, searchQuery])

		const handleEnhancePrompt = useCallback(() => {
			const trimmedInput = ui.inputValue.trim()

			if (trimmedInput) {
				setIsEnhancingPrompt(true)
				vscode.postMessage({ type: "enhancePrompt" as const, text: trimmedInput })
			} else {
				ui.setInputValue(t("chat:enhancePromptDescription"))
			}
		}, [ui, t])

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
			return [
				{ type: ContextMenuOptionType.Problems, value: "problems" },
				{ type: ContextMenuOptionType.Terminal, value: "terminal" },
				...gitCommits,
				...openedTabs
					.filter((tab) => tab.path)
					.map((tab) => ({
						type: ContextMenuOptionType.OpenedFile,
						value: "/" + tab.path,
					})),
				...filePaths
					.map((file) => "/" + file)
					.filter((path) => !openedTabs.some((tab) => tab.path && "/" + tab.path === path))
					.map((path) => ({
						type: path.endsWith("/") ? ContextMenuOptionType.Folder : ContextMenuOptionType.File,
						value: path,
					})),
			]
		}, [filePaths, gitCommits, openedTabs])

		useEffect(() => {
			const handleClickOutside = (event: MouseEvent) => {
				if (
					contextMenuContainerRef.current &&
					!contextMenuContainerRef.current.contains(event.target as Node)
				) {
					setShowContextMenu(false)
				}
			}

			if (showContextMenu) {
				document.addEventListener("mousedown", handleClickOutside)
			}

			return () => {
				document.removeEventListener("mousedown", handleClickOutside)
			}
		}, [showContextMenu, setShowContextMenu])

		const handleMentionSelect = useCallback(
			(type: ContextMenuOptionType, value?: string) => {
				if (type === ContextMenuOptionType.NoResults) {
					return
				}

				if (type === ContextMenuOptionType.Mode && value) {
					setMode(value)
					ui.setInputValue("")
					setShowContextMenu(false)
					vscode.postMessage({ type: "mode", text: value })
					return
				}

				if (type === ContextMenuOptionType.Command && value) {
					setSelectedMenuIndex(-1)
					ui.setInputValue("")
					setShowContextMenu(false)

					const commandMention = `/${value}`
					ui.setInputValue(commandMention + " ")
					setCursorPosition(commandMention.length + 1)
					setIntendedCursorPosition(commandMention.length + 1)

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
						setSelectedType(type)
						setSearchQuery("")
						setSelectedMenuIndex(0)
						return
					}
				}

				setShowContextMenu(false)
				setSelectedType(null)

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
						cursorPosition,
						insertValue,
						isSlashCommand,
					)

					ui.setInputValue(newValue)
					const newCursorPosition = newValue.indexOf(" ", mentionIndex + insertValue.length) + 1
					setCursorPosition(newCursorPosition)
					setIntendedCursorPosition(newCursorPosition)

					setTimeout(() => {
						if (textAreaRef.current) {
							textAreaRef.current.blur()
							textAreaRef.current.focus()
						}
					}, 0)
				}
			},
			// eslint-disable-next-line react-hooks/exhaustive-deps
			[ui, cursorPosition],
		)

		const handleKeyDown = useCallback(
			(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
				if (showContextMenu) {
					if (event.key === "Escape") {
						setSelectedType(null)
						setSelectedMenuIndex(3)
						return
					}

					if (event.key === "ArrowUp" || event.key === "ArrowDown") {
						event.preventDefault()
						const direction = event.key === "ArrowUp" ? -1 : 1
						setSelectedMenuIndex((prevIndex) =>
							getNextSelectableIndex(
								prevIndex,
								direction,
								searchQuery,
								selectedType,
								queryItems,
								fileSearchResults,
								allModes,
								commands,
							),
						)
						return
					}
					if ((event.key === "Enter" || event.key === "Tab") && selectedMenuIndex !== -1) {
						event.preventDefault()
						const selectedOption = getSelectedOption(
							selectedMenuIndex,
							searchQuery,
							selectedType,
							queryItems,
							fileSearchResults,
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

				if (handleHistoryNavigation(event, showContextMenu, isComposing)) {
					return
				}

				if (shouldSendOnEnter(event, enterBehavior, isComposing)) {
					event.preventDefault()
					resetHistoryNavigation()
					onSend()
				}

				if (event.key === "Backspace" && !isComposing) {
					const charBeforeCursor = ui.inputValue[cursorPosition - 1]
					const charAfterCursor = ui.inputValue[cursorPosition + 1]

					const charBeforeIsWhitespace =
						charBeforeCursor === " " || charBeforeCursor === "\n" || charBeforeCursor === "\r\n"

					const charAfterIsWhitespace =
						charAfterCursor === " " || charAfterCursor === "\n" || charAfterCursor === "\r\n"

					if (
						charBeforeIsWhitespace &&
						ui.inputValue.slice(0, cursorPosition - 1).match(new RegExp(mentionRegex.source + "$"))
					) {
						const newCursorPosition = cursorPosition - 1
						if (!charAfterIsWhitespace) {
							event.preventDefault()
							textAreaRef.current?.setSelectionRange(newCursorPosition, newCursorPosition)
							setCursorPosition(newCursorPosition)
						}

						setCursorPosition(newCursorPosition)
						setJustDeletedSpaceAfterMention(true)
					} else if (justDeletedSpaceAfterMention) {
						const { newText, newPosition } = removeMention(ui.inputValue, cursorPosition)

						if (newText !== ui.inputValue) {
							event.preventDefault()
							ui.setInputValue(newText)
							setIntendedCursorPosition(newPosition)
						}

						setJustDeletedSpaceAfterMention(false)
						setShowContextMenu(false)
					} else {
						setJustDeletedSpaceAfterMention(false)
					}
				}
			},
			[
				onSend,
				showContextMenu,
				searchQuery,
				selectedMenuIndex,
				handleMentionSelect,
				selectedType,
				ui,
				cursorPosition,
				justDeletedSpaceAfterMention,
				queryItems,
				allModes,
				fileSearchResults,
				handleHistoryNavigation,
				resetHistoryNavigation,
				commands,
				enterBehavior,
			],
		)

		useLayoutEffect(() => {
			if (intendedCursorPosition !== null && textAreaRef.current) {
				textAreaRef.current.setSelectionRange(intendedCursorPosition, intendedCursorPosition)
				setIntendedCursorPosition(null)
			}
		}, [ui, intendedCursorPosition])

		const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

		const handleInputChange = useCallback(
			(e: React.ChangeEvent<HTMLTextAreaElement>) => {
				const newValue = e.target.value
				ui.setInputValue(newValue)

				resetOnInputChange()

				const newCursorPosition = e.target.selectionStart
				setCursorPosition(newCursorPosition)

				const showMenu = shouldShowContextMenu(newValue, newCursorPosition)
				setShowContextMenu(showMenu)

				if (showMenu) {
					if (newValue.startsWith("/") && !newValue.includes(" ")) {
						const query = newValue
						setSearchQuery(query)
						setSelectedMenuIndex(1)
						vscode.postMessage({ type: "requestCommands" })
					} else {
						const lastAtIndex = newValue.lastIndexOf("@", newCursorPosition - 1)
						const query = newValue.slice(lastAtIndex + 1, newCursorPosition)
						setSearchQuery(query)

						if (query.length > 0) {
							setSelectedMenuIndex(0)

							if (searchTimeoutRef.current) {
								clearTimeout(searchTimeoutRef.current)
							}

							searchTimeoutRef.current = setTimeout(() => {
								const reqId = generateSearchRequestId()
								setSearchRequestId(reqId)
								setSearchLoading(true)

								vscode.postMessage({
									type: "searchFiles",
									query: unescapeSpaces(query),
									requestId: reqId,
								})
							}, 200)
						} else {
							setSelectedMenuIndex(3)
						}
					}
				} else {
					setSearchQuery("")
					setSelectedMenuIndex(-1)
					setFileSearchResults([])
				}
			},
			[ui, setSearchRequestId, setFileSearchResults, setSearchLoading, resetOnInputChange],
		)

		useEffect(() => {
			if (!showContextMenu) {
				setSelectedType(null)
			}
		}, [showContextMenu])

		const handleBlur = useCallback(() => {
			if (!isMouseDownOnMenu) {
				setShowContextMenu(false)
			}

			setIsFocused(false)
		}, [isMouseDownOnMenu])

		const handlePaste = useCallback(
			async (e: React.ClipboardEvent) => {
				const pastedText = e.clipboardData.getData("text")

				if (isUrl(pastedText)) {
					e.preventDefault()
					const { newValue, newCursorPosition } = insertUrlAtCursor(ui.inputValue, cursorPosition, pastedText)
					ui.setInputValue(newValue)
					setCursorPosition(newCursorPosition)
					setIntendedCursorPosition(newCursorPosition)
					setShowContextMenu(false)

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
			[shouldDisableImages, ui, cursorPosition],
		)

		const handleMenuMouseDown = useCallback(() => {
			setIsMouseDownOnMenu(true)
		}, [])

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
				setCursorPosition(textAreaRef.current.selectionStart)
			}
		}, [])

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
				setIsDraggingOver(false)

				const textFieldList = e.dataTransfer.getData("text")
				const textUriList = e.dataTransfer.getData("application/vnd.code.uri-list")
				const text = textFieldList || textUriList

				if (text) {
					const { newValue, newCursorPosition } = processDroppedText(text, ui.inputValue, cursorPosition, cwd)
					if (newValue !== ui.inputValue) {
						ui.setInputValue(newValue)
						setCursorPosition(newCursorPosition)
						setIntendedCursorPosition(newCursorPosition)
					}
					return
				}

				if (!shouldDisableImages && e.dataTransfer.files.length > 0) {
					const dataUrls = await extractImagesFromFiles(e.dataTransfer.files, ui.selectedImages.length)
					if (dataUrls.length > 0) {
						ui.appendSelectedImages(dataUrls)
						vscode.postMessage({ type: "draggedImages", dataUrls })
					}
				}
			},
			[cursorPosition, cwd, ui, shouldDisableImages],
		)

		const [isTtsPlaying, setIsTtsPlaying] = useState(false)

		useEvent("message", (event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			if (message.type === "ttsStart") {
				setIsTtsPlaying(true)
			} else if (message.type === "ttsStop") {
				setIsTtsPlaying(false)
			}
		})

		const placeholderBottomText = `\n(${t("chat:addContext")}${shouldDisableImages ? `, ${t("chat:dragFiles")}` : `, ${t("chat:dragFilesImages")}`})`

		// Common mode selector handler
		const handleModeChange = useCallback(
			(value: Mode) => {
				setMode(value)
				vscode.postMessage({ type: "mode", text: value })
			},
			[setMode],
		)

		const handleApiConfigChange = useCallback((value: string) => {
			vscode.postMessage({ type: "loadApiConfigurationById", text: value })
		}, [])

		const handleToggleLockApiConfig = useCallback(() => {
			const newValue = !lockApiConfigAcrossModes
			vscode.postMessage({ type: "lockApiConfigAcrossModes", bool: newValue })
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
								setIsDraggingOver(false)
								return
							}

							e.preventDefault()
							setIsDraggingOver(true)
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
								setIsDraggingOver(false)
							}
						}}>
						{showContextMenu && (
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
									searchQuery={searchQuery}
									inputValue={ui.inputValue}
									onMouseDown={handleMenuMouseDown}
									selectedIndex={selectedMenuIndex}
									setSelectedIndex={setSelectedMenuIndex}
									selectedType={selectedType}
									queryItems={queryItems}
									modes={allModes}
									loading={searchLoading}
									dynamicSearchResults={fileSearchResults}
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
									isFocused
										? "border border-vscode-focusBorder outline outline-vscode-focusBorder"
										: isDraggingOver
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
								onFocus={() => setIsFocused(true)}
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
									if (textAreaBaseHeight === undefined || height < textAreaBaseHeight) {
										setTextAreaBaseHeight(height)
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
									isFocused
										? "border border-vscode-focusBorder outline outline-vscode-focusBorder"
										: isDraggingOver
											? "border-2 border-dashed border-vscode-focusBorder"
											: "border border-transparent",
									isDraggingOver
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
												className={cn("w-4 h-4", isEnhancingPrompt && "animate-spin")}
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
								onClick={() => vscode.postMessage({ type: "devtoolStatus", text: "toggle" })}
								className={cn(
									devtoolEnabled
										? "text-[#ffaa00] hover:bg-[rgba(255,170,0,0.1)] active:bg-[rgba(255,170,0,0.2)]"
										: "text-vscode-foreground opacity-60 hover:opacity-100 hover:bg-[rgba(255,255,255,0.05)] active:bg-[rgba(255,255,255,0.1)]",
								)}>
								<Activity className="w-4 h-4" />
							</Button>
						</StandardTooltip>
						{isTtsPlaying && (
							<StandardTooltip content={t("chat:stopTts")}>
								<Button
									variant="iconButton"
									size="icon"
									aria-label={t("chat:stopTts")}
									onClick={() => vscode.postMessage({ type: "stopTts" })}>
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
