import type { IntentBus } from "@features/intents"
import { onWebviewMessage } from "@features/foundation"
import { IntentStatus } from "@jabberwock/types"
import { getStore } from "@features/singleton"
import {
	SETTINGS_LIST_WORKTREES,
	SETTINGS_CREATE_WORKTREE,
	SETTINGS_DELETE_WORKTREE,
	SETTINGS_SWITCH_WORKTREE,
	SETTINGS_GET_AVAILABLE_BRANCHES,
	SETTINGS_GET_WORKTREE_DEFAULTS,
	SETTINGS_GET_WORKTREE_INCLUDE_STATUS,
	SETTINGS_CHECK_BRANCH_WORKTREE_INCLUDE,
	SETTINGS_CREATE_WORKTREE_INCLUDE,
	SETTINGS_CHECKOUT_BRANCH,
	SETTINGS_BROWSE_FOR_WORKTREE_PATH,
} from "@features/settings"

function registerWorktreesHandlersSETTINGSLISTWORKTREES(): void {
	onWebviewMessage(SETTINGS_LIST_WORKTREES, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.worktree.list",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerWorktreesHandlersSETTINGSCREATEWORKTREE(): void {
	onWebviewMessage(SETTINGS_CREATE_WORKTREE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.worktree.create",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerWorktreesHandlersSETTINGSDELETEWORKTREE(): void {
	onWebviewMessage(SETTINGS_DELETE_WORKTREE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.worktree.delete",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerWorktreesHandlersSETTINGSSWITCHWORKTREE(): void {
	onWebviewMessage(SETTINGS_SWITCH_WORKTREE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.worktree.switch",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerWorktreesHandlersSETTINGSGETAVAILABLEBRANCHES(): void {
	onWebviewMessage(SETTINGS_GET_AVAILABLE_BRANCHES, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.worktree.branches.available",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerWorktreesHandlersSETTINGSGETWORKTREEDEFAULTS(): void {
	onWebviewMessage(SETTINGS_GET_WORKTREE_DEFAULTS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.worktree.defaults",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerWorktreesHandlersSETTINGSGETWORKTREEINCLUDESTATUS(): void {
	onWebviewMessage(SETTINGS_GET_WORKTREE_INCLUDE_STATUS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.worktree.include.status",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerWorktreesHandlersSETTINGSCHECKBRANCHWORKTREEINCLUDE(): void {
	onWebviewMessage(SETTINGS_CHECK_BRANCH_WORKTREE_INCLUDE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.worktree.branch.include.check",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerWorktreesHandlersSETTINGSCREATEWORKTREEINCLUDE(): void {
	onWebviewMessage(SETTINGS_CREATE_WORKTREE_INCLUDE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.worktree.include.create",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerWorktreesHandlersSETTINGSCHECKOUTBRANCH(): void {
	onWebviewMessage(SETTINGS_CHECKOUT_BRANCH, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.worktree.branch.checkout",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerWorktreesHandlersSETTINGSBROWSEFORWORKTREEPATH(): void {
	onWebviewMessage(SETTINGS_BROWSE_FOR_WORKTREE_PATH, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.worktree.path.browse",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

export function registerWorktreesHandlers(_bus: IntentBus): void {
	registerWorktreesHandlersSETTINGSLISTWORKTREES()
	registerWorktreesHandlersSETTINGSCREATEWORKTREE()
	registerWorktreesHandlersSETTINGSDELETEWORKTREE()
	registerWorktreesHandlersSETTINGSSWITCHWORKTREE()
	registerWorktreesHandlersSETTINGSGETAVAILABLEBRANCHES()
	registerWorktreesHandlersSETTINGSGETWORKTREEDEFAULTS()
	registerWorktreesHandlersSETTINGSGETWORKTREEINCLUDESTATUS()
	registerWorktreesHandlersSETTINGSCHECKBRANCHWORKTREEINCLUDE()
	registerWorktreesHandlersSETTINGSCREATEWORKTREEINCLUDE()
	registerWorktreesHandlersSETTINGSCHECKOUTBRANCH()
	registerWorktreesHandlersSETTINGSBROWSEFORWORKTREEPATH()
}
