import { sendDomQuery } from "./factory-helpers.js"
import type { DevtoolBridgeProvider } from "./factory-helpers.js"

/**
 * Wrap a DOM query result in a JSON envelope that carries the connector id of
 * the surface that answered ("vscode" | "web"). The MCP tool layer stringifies
 * this directly, so the agent sees `{"connector":"vscode","result":"..."}`.
 */
function envelope(connector: string | undefined, result: string): string {
	return JSON.stringify({ connector: connector ?? null, result })
}

export function createDomBridgeMethods(provider: DevtoolBridgeProvider) {
	return {
		async runCommand(command: string) {
			const { result, connector } = await sendDomQuery(provider, "runCommand", { command })
			return envelope(connector, result)
		},

		async findElement(selector: string, depth?: number, maxChildren?: number, command?: string) {
			const { result, connector } = await sendDomQuery(provider, "findElement", {
				selector,
				depth,
				maxChildren,
				command,
			})
			return envelope(connector, result)
		},

		async clickElement(id?: string, selector?: string) {
			const { result, connector } = await sendDomQuery(provider, "clickElement", { id, selector })
			return envelope(connector, result)
		},

		async typeText(id?: string, selector?: string, text?: string, submit?: boolean) {
			const { result, connector } = await sendDomQuery(provider, "typeText", { id, selector, text, submit })
			return envelope(connector, result)
		},

		async scrollElement(id?: string, direction?: string, selector?: string) {
			const { result, connector } = await sendDomQuery(provider, "scrollElement", { id, direction, selector })
			return envelope(connector, result)
		},

		async selectOption(id?: string, value?: string) {
			const { result, connector } = await sendDomQuery(provider, "selectOption", { id, value })
			return envelope(connector, result)
		},

		async getScreenshot() {
			const { result, connector } = await sendDomQuery(provider, "getScreenshot")
			return envelope(connector, result)
		},

		async dragElement(selector?: string, direction?: string, pixels?: number) {
			const { result, connector } = await sendDomQuery(provider, "dragElement", { selector, direction, pixels })
			return envelope(connector, result)
		},

		async dragFromTo(from?: Record<string, unknown>, to?: Record<string, unknown>) {
			const { result, connector } = await sendDomQuery(provider, "dragFromTo", { from, to })
			return envelope(connector, result)
		},
	}
}
