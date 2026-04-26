import type { ClineAsk, ClineMessage, ExtensionMessage } from "@jabberwock/types"
import { vscode } from "@src/utils/vscode"

/**
 * ── Primary Button Click Handlers ───────────────────────────────
 * Object-based dispatch instead of switch statement.
 */

export interface PrimaryClickContext {
	clineAsk: ClineAsk | undefined
	isStreaming: boolean
	currentTaskItem?: { parentTaskId?: string }
	messages: ClineMessage[]
	startNewTask: () => void
	resetAskState: () => void
	setSendingDisabled: (v: boolean) => void
	setInputValue: (v: string) => void
	setSelectedImages: (v: string[]) => void
}

type PrimaryClickHandler = (ctx: PrimaryClickContext, text?: string, images?: string[]) => void

const primaryClickHandlers: Partial<Record<ClineAsk, PrimaryClickHandler>> = {
	api_req_failed: (ctx, text, images) => {
		sendYesButton(ctx, text, images)
	},
	mistake_limit_reached: (ctx, text, images) => {
		sendYesButton(ctx, text, images)
	},
	command: (ctx, text, images) => {
		sendYesButton(ctx, text, images)
	},
	tool: (ctx, text, images) => {
		sendYesButton(ctx, text, images)
	},
	use_mcp_server: (ctx, text, images) => {
		sendYesButton(ctx, text, images)
	},
	resume_task: (ctx, text, images) => {
		const isCompletedSubtask =
			ctx.currentTaskItem?.parentTaskId &&
			ctx.messages.some((msg) => msg.ask === "completion_result" || msg.say === "completion_result")
		if (isCompletedSubtask) {
			ctx.startNewTask()
		} else {
			sendYesButton(ctx, text, images)
		}
	},
	completion_result: (ctx) => {
		ctx.startNewTask()
	},
	resume_completed_task: (ctx) => {
		ctx.startNewTask()
	},
	command_output: () => {
		vscode.postMessage({ type: "terminalOperation", terminalOperation: "continue" })
	},
}

function sendYesButton(ctx: PrimaryClickContext, text?: string, images?: string[]) {
	const trimmedInput = text?.trim()
	if (trimmedInput || (images && images.length > 0)) {
		vscode.postMessage({ type: "askResponse", askResponse: "yesButtonClicked", text: trimmedInput, images })
		ctx.setInputValue("")
		ctx.setSelectedImages([])
	} else {
		vscode.postMessage({ type: "askResponse", askResponse: "yesButtonClicked" })
	}
}

export function dispatchPrimaryClick(ctx: PrimaryClickContext, text?: string, images?: string[]): void {
	const handler = ctx.clineAsk ? primaryClickHandlers[ctx.clineAsk] : undefined
	if (handler) {
		handler(ctx, text, images)
	}
	ctx.setSendingDisabled(true)
	ctx.resetAskState()
}

/**
 * ── Secondary Button Click Handlers ─────────────────────────────
 */

export interface SecondaryClickContext {
	clineAsk: ClineAsk | undefined
	isStreaming: boolean
	startNewTask: () => void
	resetAskState: () => void
	setSendingDisabled: (v: boolean) => void
	setInputValue: (v: string) => void
	setSelectedImages: (v: string[]) => void
}

type SecondaryClickHandler = (ctx: SecondaryClickContext, text?: string, images?: string[]) => void

const secondaryClickHandlers: Partial<Record<ClineAsk, SecondaryClickHandler>> = {
	api_req_failed: (ctx) => {
		ctx.startNewTask()
	},
	mistake_limit_reached: (ctx) => {
		ctx.startNewTask()
	},
	resume_task: (ctx) => {
		ctx.startNewTask()
	},
	command: (ctx, text, images) => {
		sendNoButton(ctx, text, images)
	},
	tool: (ctx, text, images) => {
		sendNoButton(ctx, text, images)
	},
	use_mcp_server: (ctx, text, images) => {
		sendNoButton(ctx, text, images)
	},
	command_output: () => {
		vscode.postMessage({ type: "terminalOperation", terminalOperation: "abort" })
	},
}

function sendNoButton(ctx: SecondaryClickContext, text?: string, images?: string[]) {
	const trimmedInput = text?.trim()
	if (trimmedInput || (images && images.length > 0)) {
		vscode.postMessage({ type: "askResponse", askResponse: "noButtonClicked", text: trimmedInput, images })
		ctx.setInputValue("")
		ctx.setSelectedImages([])
	} else {
		vscode.postMessage({ type: "askResponse", askResponse: "noButtonClicked" })
	}
}

export function dispatchSecondaryClick(ctx: SecondaryClickContext, text?: string, images?: string[]): void {
	const handler = ctx.clineAsk ? secondaryClickHandlers[ctx.clineAsk] : undefined
	if (handler) {
		handler(ctx, text, images)
	}
	ctx.setSendingDisabled(true)
	ctx.resetAskState()
}

/**
 * ── Extension Message Handlers ──────────────────────────────────
 * Object-based dispatch for ExtensionMessage types.
 */

export interface MessageHandlerContext {
	isHidden: boolean
	sendingDisabled: boolean
	enableButtons: boolean
	isCondensing: boolean
	textAreaRef: React.RefObject<HTMLTextAreaElement | null>
	handleChatReset: (shouldPostMessage?: boolean) => void
	handleSendMessage: (text: string, images: string[]) => void
	handleSetChatBoxMessage: (text: string, images: string[]) => void
	handlePrimaryButtonClick: (text?: string, images?: string[]) => void
	handleSecondaryButtonClick: (text?: string, images?: string[]) => void
	playSound: (audioType: import("@jabberwock/types").AudioType) => void
	setIsCondensing: (v: boolean) => void
	setSendingDisabled: (v: boolean) => void
	appendSelectedImages: (images: string[]) => void
	setCheckpointWarning: (w: { type: "WAIT_TIMEOUT" | "INIT_TIMEOUT"; timeout: number } | null) => void
	updateAggregatedCosts: (key: string, value: { totalCost: number; ownCost: number; childrenCost: number }) => void
	MAX_IMAGES_PER_MESSAGE: number
}

type ActionHandler = (message: ExtensionMessage, ctx: MessageHandlerContext) => void
type InvokeHandler = (message: ExtensionMessage, ctx: MessageHandlerContext) => void

const actionHandlers: Partial<Record<string, ActionHandler>> = {
	didBecomeVisible: (_msg, ctx) => {
		if (!ctx.isHidden && !ctx.sendingDisabled && !ctx.enableButtons) {
			ctx.textAreaRef.current?.focus()
		}
	},
	focusInput: (_msg, ctx) => {
		ctx.textAreaRef.current?.focus()
	},
}

const invokeHandlers: Partial<Record<string, InvokeHandler>> = {
	newChat: (_msg, ctx) => {
		ctx.handleChatReset(false)
	},
	sendMessage: (msg, ctx) => {
		ctx.handleSendMessage(msg.text ?? "", msg.images ?? [])
	},
	setChatBoxMessage: (msg, ctx) => {
		ctx.handleSetChatBoxMessage(msg.text ?? "", msg.images ?? [])
	},
	primaryButtonClick: (msg, ctx) => {
		ctx.handlePrimaryButtonClick(msg.text ?? "", msg.images ?? [])
	},
	secondaryButtonClick: (msg, ctx) => {
		ctx.handleSecondaryButtonClick(msg.text ?? "", msg.images ?? [])
	},
	approveTodoPlan: (msg, _ctx) => {
		if (msg.values) {
			vscode.postMessage({ type: "elicitationResponse", values: msg.values })
			return
		}
		document
			.querySelectorAll("iframe")
			.forEach((iframe) => iframe.contentWindow?.postMessage({ type: "mcp-force-accept" }, "*"))
	},
}

export function dispatchExtensionMessage(message: ExtensionMessage, ctx: MessageHandlerContext): void {
	switch (message.type) {
		case "action": {
			const action = message.action
			if (action) {
				const handler = actionHandlers[action]
				handler?.(message, ctx)
			}
			break
		}
		case "selectedImages":
			if (message.context !== "edit" && message.images) {
				ctx.appendSelectedImages(message.images.slice(0, ctx.MAX_IMAGES_PER_MESSAGE))
			}
			break
		case "invoke": {
			const invoke = message.invoke
			if (invoke) {
				const handler = invokeHandlers[invoke]
				handler?.(message, ctx)
			}
			break
		}
		case "condenseTaskContextStarted":
			if (message.text) ctx.setIsCondensing(true)
			break
		case "condenseTaskContextResponse":
			if (message.text) {
				if (ctx.isCondensing && ctx.sendingDisabled) ctx.setSendingDisabled(false)
				ctx.setIsCondensing(false)
			}
			break
		case "checkpointInitWarning":
			ctx.setCheckpointWarning(message.checkpointWarning ?? null)
			break
		case "interactionRequired":
			ctx.playSound("notification")
			break
		case "taskWithAggregatedCosts":
			if (message.text && message.aggregatedCosts) {
				ctx.updateAggregatedCosts(message.text, message.aggregatedCosts)
			}
			break
	}
}
