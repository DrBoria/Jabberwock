import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

import { FlagOptions, CliSettings, DEFAULT_FLAGS, SupportedProvider } from "@/types/index.js"

import type { ExtensionHostOptions } from "@/agent/index.js"
import { readWorkspaceTaskSessions, resolveWorkspaceResumeSessionId } from "@/lib/task-history/index.js"
import { getApiKeyFromEnv } from "@/lib/utils/validation/provider.js"
import { getDefaultExtensionPath } from "@/lib/utils/env/extension.js"
import { validateTerminalShellPath } from "@/lib/utils/env/shell.js"

import { validateConsecutiveMistakeLimit } from "./validation.js"
import { handleOnboarding } from "./auth.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function resolvePrompt(promptArg: string | undefined, flagOptions: FlagOptions): string | undefined {
	if (!flagOptions.promptFile) {
		return promptArg
	}
	if (!fs.existsSync(flagOptions.promptFile)) {
		console.error(`[CLI] Error: Prompt file does not exist: ${flagOptions.promptFile}`)
		process.exit(1)
	}
	return fs.readFileSync(flagOptions.promptFile, "utf-8")
}

export function resolveMode(f: FlagOptions, s: CliSettings): string {
	return f.mode || s.mode || DEFAULT_FLAGS.mode
}
export function resolveModel(f: FlagOptions, s: CliSettings): string {
	return f.model || s.model || DEFAULT_FLAGS.model
}
export function resolveReasoningEffort(f: FlagOptions, s: CliSettings): string {
	return f.reasoningEffort || s.reasoningEffort || DEFAULT_FLAGS.reasoningEffort
}
export function resolveWorkspacePath(f: FlagOptions): string {
	return f.workspace ? path.resolve(f.workspace) : process.cwd()
}
export function resolveRequireApproval(f: FlagOptions, s: CliSettings): boolean {
	const l =
		s.requireApproval ?? (s.dangerouslySkipPermissions === undefined ? undefined : !s.dangerouslySkipPermissions)
	return f.requireApproval || l || false
}
export function resolveExitOnComplete(f: FlagOptions, s: CliSettings): boolean {
	return f.print || f.oneshot || s.oneshot || false
}

export function buildExtensionHostOptions(f: FlagOptions, s: CliSettings, p: SupportedProvider): ExtensionHostOptions {
	const m = resolveMode(f, s),
		m2 = resolveModel(f, s),
		r = resolveReasoningEffort(f, s),
		w = resolveWorkspacePath(f),
		a = resolveRequireApproval(f, s),
		e = resolveExitOnComplete(f, s)
	const raw = f.consecutiveMistakeLimit ?? s.consecutiveMistakeLimit ?? DEFAULT_FLAGS.consecutiveMistakeLimit
	return {
		mode: m,
		reasoningEffort: (r === "unspecified" ? undefined : r) as ExtensionHostOptions["reasoningEffort"],
		consecutiveMistakeLimit: validateConsecutiveMistakeLimit(raw),
		user: null,
		provider: p,
		model: m2,
		apiKey: f.apiKey || getApiKeyFromEnv(p),
		workspacePath: w,
		extensionPath: path.resolve(f.extension || getDefaultExtensionPath(__dirname)),
		nonInteractive: !a,
		exitOnError: f.exitOnError,
		ephemeral: f.ephemeral,
		debug: f.debug,
		exitOnComplete: e,
	}
}

export async function resolveTerminalShell(f: FlagOptions): Promise<string | undefined> {
	if (f.terminalShell === undefined) return undefined
	const validated = await validateTerminalShellPath(f.terminalShell)
	if (!validated.valid) {
		console.error(`[CLI] Warning: ignoring --terminal-shell "${f.terminalShell}" (${validated.reason})`)
		return undefined
	}
	return validated.shellPath
}

export async function resolveProvider(
	f: FlagOptions,
	s: CliSettings,
	rooToken: string | null,
	t: boolean,
): Promise<SupportedProvider> {
	let ep = f.provider ?? s.provider ?? (rooToken ? "jabberwock" : "openrouter")
	if (t && !rooToken && !f.provider && !s.provider) {
		const o = await handleOnboarding(f, s)
		if (o.provider) {
			ep = o.provider as SupportedProvider
		}
	}
	return ep as SupportedProvider
}

export async function resolveResumeSessionId(
	irr: boolean,
	wp: string,
	rsid: string | undefined,
): Promise<string | undefined> {
	if (!irr) return undefined
	const ws = await readWorkspaceTaskSessions(wp)
	try {
		return resolveWorkspaceResumeSessionId(ws, rsid)
	} catch (error) {
		console.error(`[CLI] Error: ${error instanceof Error ? error.message : String(error)}`)
		process.exit(1)
	}
}
