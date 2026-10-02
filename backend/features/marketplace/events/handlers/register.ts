import type { IntentBus } from "@features/intents"
import { registerOnMarketplace } from "@features/marketplace"
import { onWebviewMessage } from "@features/foundation"
import { IntentStatus } from "@jabberwock/types"
import { getStore } from "@features/singleton"
import {
	MARKETPLACE_MARKETPLACE_BUTTON_CLICKED,
	MARKETPLACE_FILTER_MARKETPLACE_ITEMS,
	MARKETPLACE_INSTALL_MARKETPLACE_ITEM,
	MARKETPLACE_INSTALL_MARKETPLACE_ITEM_WITH_PARAMETERS,
	MARKETPLACE_CANCEL_MARKETPLACE_INSTALL,
	MARKETPLACE_REMOVE_INSTALLED_MARKETPLACE_ITEM,
	MARKETPLACE_FETCH_MARKETPLACE_DATA,
	MARKETPLACE_REFRESH_CUSTOM_TOOLS,
	MARKETPLACE_REQUEST_SKILLS,
	MARKETPLACE_CREATE_SKILL,
	MARKETPLACE_DELETE_SKILL,
	MARKETPLACE_MOVE_SKILL,
	MARKETPLACE_UPDATE_SKILL_MODES,
	MARKETPLACE_OPEN_SKILL_FILE,
} from "@features/marketplace/events"

function registerOnMarketplaceMARKETPLACEMARKETPLACEBUTTONCLICKED(): void {
	onWebviewMessage(MARKETPLACE_MARKETPLACE_BUTTON_CLICKED, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "marketplace.button.clicked",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnMarketplaceMARKETPLACEFILTERMARKETPLACEITEMS(): void {
	onWebviewMessage(MARKETPLACE_FILTER_MARKETPLACE_ITEMS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "marketplace.items.filter",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnMarketplaceMARKETPLACEINSTALLMARKETPLACEITEM(): void {
	onWebviewMessage(MARKETPLACE_INSTALL_MARKETPLACE_ITEM, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "marketplace.item.install",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnMarketplaceMARKETPLACEINSTALLMARKETPLACEITEMWITHPARAMETERS(): void {
	onWebviewMessage(MARKETPLACE_INSTALL_MARKETPLACE_ITEM_WITH_PARAMETERS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "marketplace.item.install.with.parameters",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnMarketplaceMARKETPLACECANCELMARKETPLACEINSTALL(): void {
	onWebviewMessage(MARKETPLACE_CANCEL_MARKETPLACE_INSTALL, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "marketplace.install.cancel",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnMarketplaceMARKETPLACEREMOVEINSTALLEDMARKETPLACEITEM(): void {
	onWebviewMessage(MARKETPLACE_REMOVE_INSTALLED_MARKETPLACE_ITEM, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "marketplace.item.remove",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnMarketplaceMARKETPLACEFETCHMARKETPLACEDATA(): void {
	onWebviewMessage(MARKETPLACE_FETCH_MARKETPLACE_DATA, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "marketplace.data.fetch",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnMarketplaceMARKETPLACEREFRESHCUSTOMTOOLS(): void {
	onWebviewMessage(MARKETPLACE_REFRESH_CUSTOM_TOOLS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "marketplace.tools.refresh",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnMarketplaceMARKETPLACEREQUESTSKILLS(): void {
	onWebviewMessage(MARKETPLACE_REQUEST_SKILLS, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.skills.request",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnMarketplaceMARKETPLACECREATESKILL(): void {
	onWebviewMessage(MARKETPLACE_CREATE_SKILL, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.skill.create",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnMarketplaceMARKETPLACEDELETESKILL(): void {
	onWebviewMessage(MARKETPLACE_DELETE_SKILL, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.skill.delete",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnMarketplaceMARKETPLACEMOVESKILL(): void {
	onWebviewMessage(MARKETPLACE_MOVE_SKILL, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.skill.move",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnMarketplaceMARKETPLACEUPDATESKILLMODES(): void {
	onWebviewMessage(MARKETPLACE_UPDATE_SKILL_MODES, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.skill.modes.update",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

function registerOnMarketplaceMARKETPLACEOPENSKILLFILE(): void {
	onWebviewMessage(MARKETPLACE_OPEN_SKILL_FILE, (_provider, message) => {
		const store = getStore()
		if (!store) return
		store.intentStore.createIntent({
			id: crypto.randomUUID(),
			type: "settings.skill.file.open",
			payload: { taskId: store.chat.activeTaskId ?? "", ...message },
			status: IntentStatus.Queued,
			createdAt: Date.now(),
		})
	})
}

export function registerOnMarketplaceIntents(bus: IntentBus): void {
	registerOnMarketplace(bus)
	registerOnMarketplaceMARKETPLACEMARKETPLACEBUTTONCLICKED()
	registerOnMarketplaceMARKETPLACEFILTERMARKETPLACEITEMS()
	registerOnMarketplaceMARKETPLACEINSTALLMARKETPLACEITEM()
	registerOnMarketplaceMARKETPLACEINSTALLMARKETPLACEITEMWITHPARAMETERS()
	registerOnMarketplaceMARKETPLACECANCELMARKETPLACEINSTALL()
	registerOnMarketplaceMARKETPLACEREMOVEINSTALLEDMARKETPLACEITEM()
	registerOnMarketplaceMARKETPLACEFETCHMARKETPLACEDATA()
	registerOnMarketplaceMARKETPLACEREFRESHCUSTOMTOOLS()
	registerOnMarketplaceMARKETPLACEREQUESTSKILLS()
	registerOnMarketplaceMARKETPLACECREATESKILL()
	registerOnMarketplaceMARKETPLACEDELETESKILL()
	registerOnMarketplaceMARKETPLACEMOVESKILL()
	registerOnMarketplaceMARKETPLACEUPDATESKILLMODES()
	registerOnMarketplaceMARKETPLACEOPENSKILLFILE()
}
