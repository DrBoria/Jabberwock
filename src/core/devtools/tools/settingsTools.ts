import { z } from "zod"
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { type ClineProvider } from "../../webview/ClineProvider"

export function registerSettingsTools(mcpServer: McpServer, provider: ClineProvider) {
	mcpServer.tool("get_settings", {}, async () => {
		try {
			const settings = provider.contextProxy.getValues()
			const currentName = settings.currentApiConfigName
			let activeProfileDetails = {}

			if (currentName) {
				activeProfileDetails = await provider.providerSettingsManager.getProfile({ name: currentName })
			}

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								activeProfile: currentName,
								activeProfileDetails,
								allSettings: settings,
							},
							null,
							2,
						),
					},
				],
			}
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Error getting settings: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	})
}
