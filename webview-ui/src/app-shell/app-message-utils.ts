import { useCallback, useRef } from "react"
import { useEvent } from "react-use"
import type { ExtensionMessage } from "@jabberwock/types"
import { rootStore } from "@src/features/store"
import { chatTreeStore } from "@src/features/chat/tree/store"
import { tabsByMessageAction, storeQueryActions, domHandlerActions } from "./app-types"
import type { ChatViewRef } from "../features/chat/task/messages/view"

export const getWindowLabel = (aw: { type: string; props?: Record<string, unknown> }) => {
	if (aw.type !== "chat") return aw.type
	const nid = aw.props?.targetNodeId as string | undefined
	if (!nid) return aw.type
	const n = chatTreeStore.nodes.get(nid)
	return n ? n.mode || "Agent" : aw.type
}

const isSwitchTabAction = (action: string, message: ExtensionMessage) => action === "switchTab" && !!message.tab

const handleSwitchTabMessage = (message: ExtensionMessage, st: (t: string, p?: Record<string, unknown>) => void) => {
	if (message.fromMCP) {
		console.log("[App] Ignoring MCP-originated switchTab to prevent loop")
		return
	}
	st(message.tab as string, {
		section: message.values?.section as string | undefined,
		targetNodeId: message.values?.targetNodeId as string | undefined,
	})
}

const handleTabAction = (
	action: string,
	message: ExtensionMessage,
	st: (t: string, p?: Record<string, unknown>) => void,
) => {
	const nt = tabsByMessageAction[action]
	console.log(`[App] Mapping action ${action} to tab ${nt}`)
	if (nt)
		st(nt, {
			section: message.values?.section as string | undefined,
			marketplaceTab: message.values?.marketplaceTab as "mcp" | "mode" | undefined,
			targetNodeId: message.values?.targetNodeId as string | undefined,
		})
}

const handleRequestId = (action: string, message: ExtensionMessage, wm: { activeWindows: Array<{ type: string }> }) => {
	const r = message.requestId,
		isStore = storeQueryActions.includes(action),
		isDom = domHandlerActions.includes(action)
	if (r && !isStore && !isDom) {
		const tw = wm.activeWindows[wm.activeWindows.length - 1]
		rootStore.windowManager.respondWithActivePage(r, tw ? tw.type : "chat")
	}
}

export const handleActionMessage = (
	action: string,
	message: ExtensionMessage,
	st: (t: string, p?: Record<string, unknown>) => void,
	wm: { activeWindows: Array<{ type: string }> },
) => {
	console.log(`[App] Received action message: ${action}`, message)
	if (isSwitchTabAction(action, message)) {
		handleSwitchTabMessage(message, st)
		return
	}
	handleTabAction(action, message, st)
	handleRequestId(action, message, wm)
}

const isActionMessage = (m: ExtensionMessage): m is ExtensionMessage & { action: string } =>
	m.type === "action" && !!m.action
const isDeleteDialogMessage = (m: ExtensionMessage): m is ExtensionMessage & { messageTs: number } =>
	m.type === "showDeleteMessageDialog" && !!m.messageTs
const isEditDialogMessage = (m: ExtensionMessage): m is ExtensionMessage & { messageTs: number; text: string } =>
	m.type === "showEditMessageDialog" && !!m.messageTs && !!m.text
const isAcceptInputMessage = (m: ExtensionMessage) => m.type === "acceptInput"

export function useMessageHandler(
	st: (t: string, p?: Record<string, unknown>) => void,
	wm: { activeWindows: Array<{ type: string }> },
	del: (ts: number, ch: boolean) => void,
	ed: (ts: number, txt: string, ch: boolean, im?: string[]) => void,
	cvr: React.RefObject<ChatViewRef | null>,
) {
	const ref = useRef({ st, wm, del, ed, cvr })
	ref.current = { st, wm, del, ed, cvr }
	useEvent(
		"message",
		useCallback((e: MessageEvent) => {
			const { st: st2, wm: w2, del: d2, ed: e2, cvr: c2 } = ref.current,
				msg: ExtensionMessage = e.data
			if (isActionMessage(msg)) {
				handleActionMessage(msg.action, msg, st2, w2)
				return
			}
			if (isDeleteDialogMessage(msg)) {
				d2(msg.messageTs, !!msg.hasCheckpoint)
				return
			}
			if (isEditDialogMessage(msg)) {
				e2(msg.messageTs, msg.text, !!msg.hasCheckpoint, msg.images)
				return
			}
			if (isAcceptInputMessage(msg)) c2.current?.acceptInput()
		}, []),
	)
}
