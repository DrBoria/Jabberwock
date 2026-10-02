import type { IntentBus } from "@src/features/intents/bus"
import { IntentConstants } from "@intentConstants"
import type { IntentHandlerContext } from "@src/features/intents/context"
import { getRootStore } from "@src/features/root-store"
import { convertTextMateToHljs } from "@src/utils/text/convertTextMateToHljs"
import type { ProviderSettingsEntry, RouterModels, McpServer, SkillMetadata } from "@jabberwock/types"

/**
 * Register all frontend settings event handlers on the IntentBus.
 */
function registerOnFrontendSettingsIntentsReg0(bus: IntentBus): void {
	bus.register(IntentConstants.settings.THEME_UPDATED, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as { text?: string }
		if (payload.text) {
			store.theme = convertTextMateToHljs(JSON.parse(payload.text))
		}
	})
}

function registerOnFrontendSettingsIntentsReg1(bus: IntentBus): void {
	bus.register(IntentConstants.settings.LIST_API_CONFIG, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as { listApiConfig?: unknown[] }
		store.extensionState = {
			...store.extensionState,
			listApiConfigMeta: (payload.listApiConfig ?? []) as ProviderSettingsEntry[],
		}
	})
}

function registerOnFrontendSettingsIntentsReg2(bus: IntentBus): void {
	bus.register(IntentConstants.settings.ROUTER_MODELS, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as { routerModels?: unknown }
		store.settings.setRouterModels(payload.routerModels as RouterModels)
	})
}

function registerOnFrontendSettingsIntentsReg3(bus: IntentBus): void {
	bus.register(IntentConstants.settings.MCP_SERVERS, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as { mcpServers?: unknown[] }
		store.settings.setMcpServers((payload.mcpServers ?? []) as McpServer[])
	})
}

function registerOnFrontendSettingsIntentsReg4(bus: IntentBus): void {
	bus.register(IntentConstants.settings.SKILLS, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as { skills?: unknown }
		if (payload.skills) {
			store.marketplace.setSkills(payload.skills as SkillMetadata[])
		}
	})
}

export function registerOnFrontendSettingsIntents(bus: IntentBus): void {
	registerOnFrontendSettingsIntentsReg0(bus)
	registerOnFrontendSettingsIntentsReg1(bus)
	registerOnFrontendSettingsIntentsReg2(bus)
	registerOnFrontendSettingsIntentsReg3(bus)
	registerOnFrontendSettingsIntentsReg4(bus)
}
