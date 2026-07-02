import type { IntentBus } from "../../../intents/bus"
import { IntentConstants } from "@intentConstants"
import type { IntentHandlerContext } from "../../../intents/context"
import { getRootStore } from "../../../root-store"
import { convertTextMateToHljs } from "../../../../utils/text/convertTextMateToHljs"
import type { ProviderSettingsEntry, RouterModels, McpServer, SkillMetadata } from "@jabberwock/types"

/**
 * Register all frontend settings event handlers on the IntentBus.
 */
export function registerOnFrontendSettingsIntents(bus: IntentBus): void {
	bus.register(IntentConstants.settings.THEME_UPDATED, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as { text?: string }
		if (payload.text) {
			store.theme = convertTextMateToHljs(JSON.parse(payload.text))
		}
	})

	bus.register(IntentConstants.settings.LIST_API_CONFIG, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as { listApiConfig?: unknown[] }
		store.extensionState = {
			...store.extensionState,
			listApiConfigMeta: (payload.listApiConfig ?? []) as ProviderSettingsEntry[],
		}
	})

	bus.register(IntentConstants.settings.ROUTER_MODELS, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as { routerModels?: unknown }
		store.settings.setRouterModels(payload.routerModels as RouterModels)
	})

	bus.register(IntentConstants.settings.MCP_SERVERS, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as { mcpServers?: unknown[] }
		store.settings.setMcpServers((payload.mcpServers ?? []) as McpServer[])
	})

	bus.register(IntentConstants.settings.SKILLS, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as { skills?: unknown }
		if (payload.skills) {
			store.marketplace.setSkills(payload.skills as SkillMetadata[])
		}
	})
}
