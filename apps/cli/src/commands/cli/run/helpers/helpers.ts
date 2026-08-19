import path from "path"
import { fileURLToPath } from "url"

import { createElement } from "react"
import { render } from "ink"

import { VERSION } from "@/lib/utils/env/version.js"
import { App } from "../../../../ui/App.js"

import { ExtensionHost, ExtensionHostOptions } from "@/agent/index.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export async function renderTui(
	e: ExtensionHostOptions,
	prompt: string | undefined,
	rcs: string | undefined,
	rrs: string | undefined,
): Promise<void> {
	try {
		render(
			createElement(App, {
				...e,
				initialPrompt: prompt,
				initialTaskId: rcs,
				initialSessionId: rrs,
				continueSession: false,
				version: VERSION,
				createExtensionHost: (opts: ExtensionHostOptions) => new ExtensionHost(opts),
			}),
			{ exitOnCtrlC: false },
		)
	} catch (error) {
		console.error("[CLI] Failed to start TUI:", error instanceof Error ? error.message : String(error))
		if (error instanceof Error) {
			console.error(error.stack)
		}
		process.exit(1)
	}
}
