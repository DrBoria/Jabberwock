import { useEffect, useRef } from "react"
import { useInput, type Key } from "ink"
import type { WebviewMessage } from "@jabberwock/types"

import { matchesGlobalSequence } from "@/lib/utils/validation/input.js"

import type { ModeResult } from "../../components/autocomplete/index.js"
import { useUIStateStore } from "../../stores/uiStateStore.js"
import { useCLIStore } from "../../store.js"

export interface UseGlobalInputOptions {
	canToggleFocus: boolean
	isScrollAreaActive: boolean
	pickerIsOpen: boolean
	availableModes: ModeResult[]
	currentMode: string | null
	mode: string
	sendToExtension: ((msg: WebviewMessage) => void) | null
	showInfo: (msg: string, duration?: number) => void
	exit: () => void
	cleanup: () => Promise<void>
	toggleFocus: () => void
	closePicker: () => void
}

interface InputContext {
	isLoading: boolean
	currentTodos: unknown[]
	showTodoViewer: boolean
	setShowTodoViewer: (v: boolean) => void
	setShowExitHint: (v: boolean) => void
	pendingExit: boolean
	setPendingExit: (v: boolean) => void
	exitHintTimeout: React.MutableRefObject<NodeJS.Timeout | null>
	canToggleFocus: boolean
	pickerIsOpen: boolean
	availableModes: ModeResult[]
	currentMode: string | null
	mode: string
	sendToExtension: ((msg: WebviewMessage) => void) | null
	showInfo: (msg: string, duration?: number) => void
	exit: () => void
	cleanup: () => Promise<void>
	toggleFocus: () => void
	closePicker: () => void
}

function handleTabKey(ctx: InputContext): boolean {
	if (ctx.canToggleFocus && !ctx.pickerIsOpen) {
		ctx.toggleFocus()
		return true
	}
	return false
}

function handleCtrlMKey(input: string, key: Key, ctx: InputContext): boolean {
	if (!matchesGlobalSequence(input, key, "ctrl-m")) {
		return false
	}

	if (ctx.isLoading) {
		ctx.showInfo("Cannot switch modes while task is in progress", 2000)
		return true
	}

	if (ctx.availableModes.length < 2) {
		return true
	}

	const currentModeSlug = ctx.currentMode || ctx.mode
	const currentIndex = ctx.availableModes.findIndex((m) => m.slug === currentModeSlug)
	const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % ctx.availableModes.length
	const nextMode = ctx.availableModes[nextIndex]

	if (nextMode && ctx.sendToExtension) {
		ctx.sendToExtension({ type: "mode", text: nextMode.slug })
		ctx.showInfo(`Switched to ${nextMode.name}`, 2000)
	}

	return true
}

function handleCtrlTKey(input: string, key: Key, ctx: InputContext): boolean {
	if (!matchesGlobalSequence(input, key, "ctrl-t")) {
		return false
	}

	if (ctx.pickerIsOpen) {
		ctx.closePicker()
	}

	ctx.setShowTodoViewer(!ctx.showTodoViewer)
	if (!ctx.showTodoViewer && ctx.currentTodos.length === 0) {
		ctx.showInfo("No TODO list available", 2000)
		ctx.setShowTodoViewer(false)
	}

	return true
}

function handleEscapeKey(key: { escape?: boolean }, ctx: InputContext): boolean {
	if (!key.escape) {
		return false
	}

	if (ctx.showTodoViewer) {
		ctx.setShowTodoViewer(false)
		return true
	}

	if (ctx.isLoading && ctx.sendToExtension && !ctx.pickerIsOpen) {
		ctx.sendToExtension({ type: "cancelTask" })
		return true
	}

	return false
}

function handleCtrlC(input: string, key: { ctrl?: boolean }, ctx: InputContext): boolean {
	if (!(key.ctrl && input === "c")) {
		return false
	}

	if (ctx.pickerIsOpen) {
		ctx.closePicker()
		return true
	}

	if (ctx.pendingExit) {
		if (ctx.exitHintTimeout.current) {
			clearTimeout(ctx.exitHintTimeout.current)
		}
		ctx.cleanup().finally(() => {
			ctx.exit()
			process.exit(0)
		})
	} else {
		ctx.setPendingExit(true)
		ctx.setShowExitHint(true)
		ctx.exitHintTimeout.current = setTimeout(() => {
			ctx.setPendingExit(false)
			ctx.setShowExitHint(false)
			ctx.exitHintTimeout.current = null
		}, 2000)
	}

	return true
}

/**
 * Hook to handle global keyboard shortcuts.
 *
 * Shortcuts:
 * - Ctrl+C: Double-press to exit
 * - Tab: Toggle focus between scroll area and input
 * - Ctrl+M: Cycle through available modes
 * - Ctrl+T: Toggle TODO list viewer
 * - Escape: Cancel task (when loading) or close TODO viewer
 */
export function useGlobalInput({
	canToggleFocus,
	isScrollAreaActive: _isScrollAreaActive,
	pickerIsOpen,
	availableModes,
	currentMode,
	mode,
	sendToExtension,
	showInfo,
	exit,
	cleanup,
	toggleFocus,
	closePicker,
}: UseGlobalInputOptions): void {
	const { isLoading, currentTodos } = useCLIStore()
	const {
		showTodoViewer,
		setShowTodoViewer,
		showExitHint: _showExitHint,
		setShowExitHint,
		pendingExit,
		setPendingExit,
	} = useUIStateStore()

	const exitHintTimeout = useRef<NodeJS.Timeout | null>(null)

	useEffect(() => {
		return () => {
			if (exitHintTimeout.current) {
				clearTimeout(exitHintTimeout.current)
			}
		}
	}, [])

	const ctx: InputContext = {
		isLoading,
		currentTodos,
		showTodoViewer,
		setShowTodoViewer,
		setShowExitHint,
		pendingExit,
		setPendingExit,
		exitHintTimeout,
		canToggleFocus,
		pickerIsOpen,
		availableModes,
		currentMode,
		mode,
		sendToExtension,
		showInfo,
		exit,
		cleanup,
		toggleFocus,
		closePicker,
	}

	useInput((input, key) => {
		if (handleTabKey(ctx)) return
		if (handleCtrlMKey(input, key, ctx)) return
		if (handleCtrlTKey(input, key, ctx)) return
		if (handleEscapeKey(key, ctx)) return
		handleCtrlC(input, key, ctx)
	})
}
