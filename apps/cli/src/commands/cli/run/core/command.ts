import { setLogger } from "@jabberwock/vscode-shim"

import { FlagOptions, OutputFormat } from "@/types/index.js"
import { loadToken, loadSettings } from "@/lib/storage/index.js"

import {
	resolvePrompt,
	validateSessionFlags,
	resolveProvider,
	buildExtensionHostOptions,
	resolveTerminalShell,
	handleJabberwockAuth,
	validateEffectiveOptions,
	resolveResumeSessionId,
	validateRequiredFlags,
	renderTui,
	runPrintMode,
} from "../index.js"

export async function run(promptArg: string | undefined, flagOptions: FlagOptions) {
	setLogger({ info: () => {}, warn: () => {}, error: () => {}, debug: () => {} })
	const prompt = resolvePrompt(promptArg, flagOptions)
	validateSessionFlags(flagOptions, prompt)
	const requestedSessionId = flagOptions.sessionId?.trim(),
		requestedCreateSessionId = flagOptions.createWithSessionId?.trim(),
		shouldContinueSession = flagOptions.continue
	const isResumeRequested = Boolean(requestedSessionId || shouldContinueSession)
	const rooToken = await loadToken(),
		settings = await loadSettings()
	const isTuiSupported = process.stdin.isTTY && process.stdout.isTTY,
		isTuiEnabled = !flagOptions.print && isTuiSupported
	const effectiveProvider = await resolveProvider(flagOptions, settings, rooToken, isTuiEnabled)
	const extensionHostOptions = buildExtensionHostOptions(flagOptions, settings, effectiveProvider)
	extensionHostOptions.terminalShell = await resolveTerminalShell(flagOptions)
	await handleJabberwockAuth(extensionHostOptions, rooToken, flagOptions)
	const outputFormat: OutputFormat = (flagOptions.outputFormat as OutputFormat) || "text",
		debug = flagOptions.debug ?? false
	const useStdinPromptStream = flagOptions.stdinPromptStream,
		signalOnlyExit = flagOptions.signalOnlyExit
	validateEffectiveOptions(extensionHostOptions, flagOptions, outputFormat, isTuiSupported, prompt)
	const resolvedResumeSessionId = await resolveResumeSessionId(
		isResumeRequested,
		extensionHostOptions.workspacePath,
		requestedSessionId,
	)
	validateRequiredFlags(flagOptions, isTuiEnabled, prompt, useStdinPromptStream, isResumeRequested)
	if (isTuiEnabled) {
		await renderTui(extensionHostOptions, prompt, requestedCreateSessionId, resolvedResumeSessionId)
	} else {
		await runPrintMode(
			extensionHostOptions,
			outputFormat,
			useStdinPromptStream,
			signalOnlyExit,
			{ ...flagOptions, debug },
			prompt,
			requestedCreateSessionId,
			isResumeRequested,
			resolvedResumeSessionId,
		)
	}
}
