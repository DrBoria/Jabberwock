import { sendDomQuery } from "./factory-helpers.js"
import type { DevtoolBridgeProvider } from "./factory-helpers.js"

export function createDomBridgeMethods(provider: DevtoolBridgeProvider) {
	return {
		async runCommand(command: string) {
			return sendDomQuery(provider, "runCommand", { command })
		},

		async findElement(selector: string, depth?: number, maxChildren?: number, command?: string) {
			return sendDomQuery(provider, "findElement", { selector, depth, maxChildren, command })
		},

		async clickElement(id?: string, selector?: string) {
			return sendDomQuery(provider, "clickElement", { id, selector })
		},

		async typeText(id?: string, selector?: string, text?: string, submit?: boolean) {
			return sendDomQuery(provider, "typeText", { id, selector, text, submit })
		},

		async scrollElement(id?: string, direction?: string, selector?: string) {
			return sendDomQuery(provider, "scrollElement", { id, direction, selector })
		},

		async selectOption(id?: string, value?: string) {
			return sendDomQuery(provider, "selectOption", { id, value })
		},

		async getScreenshot() {
			return sendDomQuery(provider, "getScreenshot")
		},

		async dragElement(selector?: string, direction?: string, pixels?: number) {
			return sendDomQuery(provider, "dragElement", { selector, direction, pixels })
		},

		async dragFromTo(from?: Record<string, unknown>, to?: Record<string, unknown>) {
			return sendDomQuery(provider, "dragFromTo", { from, to })
		},
	}
}
