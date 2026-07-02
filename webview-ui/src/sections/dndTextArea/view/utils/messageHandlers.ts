import type React from "react"
import { ContextMenuOptionType, type SearchResult } from "../../utils/context-mentions/context-mentions"
import type { IDynamicTextAreaStore } from "../../store"

export function handleEnhancedPromptResult(
	message: { text?: string },
	textAreaRef: React.RefObject<HTMLTextAreaElement | null>,
	textAreaStore: IDynamicTextAreaStore,
): void {
	if (message.text && textAreaRef.current) {
		try {
			if (document.execCommand) {
				const textarea = textAreaRef.current
				textarea.focus()
				textarea.select()
				document.execCommand("insertText", false, message.text)
			} else {
				textAreaStore.setInputValue(message.text)
			}
		} catch {
			textAreaStore.setInputValue(message.text)
		}
	}

	textAreaStore.setIsEnhancingPrompt(false)
}

export function handleInsertTextHandler(
	message: { text?: string },
	textAreaRef: React.RefObject<HTMLTextAreaElement | null>,
	textAreaStore: IDynamicTextAreaStore,
): void {
	if (!message.text || !textAreaRef.current) {
		return
	}

	const textarea = textAreaRef.current
	const currentValue = textAreaStore.inputValue
	const cursorPos = textarea.selectionStart || 0

	const textBefore = currentValue.slice(0, cursorPos)
	const needsSpaceBefore = textBefore.length > 0 && !textBefore.endsWith(" ")
	const prefix = needsSpaceBefore ? " " : ""

	const newValue = currentValue.slice(0, cursorPos) + prefix + message.text + " " + currentValue.slice(cursorPos)
	textAreaStore.setInputValue(newValue)

	const newCursorPos = cursorPos + prefix.length + message.text.length + 1
	setTimeout(() => {
		if (textAreaRef.current) {
			textAreaRef.current.focus()
			textAreaRef.current.setSelectionRange(newCursorPos, newCursorPos)
		}
	}, 0)
}

export function handleCommitSearchResultsHandler(
	message: { commits: Array<{ hash: string; subject: string; shortHash: string; author: string; date: string }> },
	textAreaStore: IDynamicTextAreaStore,
): void {
	const commits = message.commits.map((commit) => ({
		type: ContextMenuOptionType.Git,
		value: commit.hash,
		label: commit.subject,
		description: `${commit.shortHash} by ${commit.author} on ${commit.date}`,
		icon: "$(git-commit)",
	}))

	textAreaStore.setGitCommits(commits)
}

export function handleFileSearchResultsHandler(
	message: { requestId?: string; results?: SearchResult[] },
	textAreaStore: IDynamicTextAreaStore,
): void {
	textAreaStore.setSearchLoading(false)
	if (message.requestId === textAreaStore.searchRequestId) {
		textAreaStore.setFileSearchResults(message.results || [])
	}
}
