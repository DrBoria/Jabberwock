import fs from "fs"

import { FlagOptions, isSupportedProvider, supportedProviders, REASONING_EFFORTS, OutputFormat } from "@/types/index.js"
import { isValidOutputFormat } from "@/types/json-events.js"

import type { ExtensionHostOptions } from "@/agent/index.js"
import { getEnvVarName } from "@/lib/utils/validation/provider.js"
import { isValidSessionId } from "@/lib/utils/validation/session-id.js"

import { fail, failWithUsage } from "../helpers/errors.js"

export function checkCreateSessionId(a: string | undefined, b: string | undefined): void {
	if (a !== undefined && !b) {
		fail("--create-with-session-id requires a non-empty session id")
	}
	if (b && !isValidSessionId(b)) {
		fail("--session-id must be a valid UUID session id")
	}
	if (a && b && !isValidSessionId(b)) {
		fail("--create-with-session-id must be a valid UUID session id")
	}
}

export function checkSessionConflicts(
	a: string | undefined,
	b: string | undefined,
	c: boolean,
	d: string | undefined,
): void {
	if (a && (b || c)) {
		fail("cannot use --create-with-session-id with --session-id/--continue")
	}
	if (b && c) {
		fail("cannot use --session-id with --continue")
	}
	if ((b || c) && d) {
		failWithUsage(
			"cannot use prompt or --prompt-file with --session-id/--continue",
			"jabberwock [--session-id <session-id> | --continue] [options]",
		)
	}
}

export function validateSessionFlags(flagOptions: FlagOptions, prompt: string | undefined): void {
	const a = flagOptions.sessionId?.trim(),
		b = flagOptions.createWithSessionId?.trim(),
		c = flagOptions.continue
	checkCreateSessionId(flagOptions.createWithSessionId, a)
	checkSessionConflicts(b, a, c, prompt)
}

export function checkOutputBaseFlags(o: OutputFormat, f: FlagOptions, t: boolean): void {
	if (o !== "text" && !f.print && t) {
		failWithUsage("--output-format requires --print mode", "jabberwock --print --output-format json")
	}
	if (f.stdinPromptStream && !f.print) {
		failWithUsage(
			"--stdin-prompt-stream requires --print mode",
			"jabberwock --print --output-format stream-json --stdin-prompt-stream [options]",
		)
	}
	if (f.signalOnlyExit && !f.stdinPromptStream) {
		failWithUsage(
			"--signal-only-exit requires --stdin-prompt-stream",
			"jabberwock --print --output-format stream-json --stdin-prompt-stream --signal-only-exit",
		)
	}
}

export function checkStdinStreamFlags(f: FlagOptions, o: OutputFormat, p: string | undefined): void {
	if (f.stdinPromptStream && o !== "stream-json") {
		failWithUsage(
			"--stdin-prompt-stream requires --output-format=stream-json",
			"jabberwock --print --output-format stream-json --stdin-prompt-stream [options]",
		)
	}
	if (f.stdinPromptStream && process.stdin.isTTY) {
		failWithUsage(
			"--stdin-prompt-stream requires piped stdin",
			`printf '{"command":"start","requestId":"1","prompt":"1+1=?"}\\n' | jabberwock --print --output-format stream-json --stdin-prompt-stream [options]`,
		)
	}
	if (f.stdinPromptStream && p) {
		failWithUsage(
			"cannot use positional prompt or --prompt-file with --stdin-prompt-stream",
			"jabberwock --print --output-format stream-json --stdin-prompt-stream [options]",
		)
	}
	if (f.stdinPromptStream && f.createWithSessionId?.trim()) {
		failWithUsage(
			"--create-with-session-id is not supported with --stdin-prompt-stream",
			`Use per-request "taskId" in stdin start commands instead.`,
		)
	}
}

export function validateOutputFormatFlags(f: FlagOptions, o: OutputFormat, t: boolean, p: string | undefined): void {
	checkOutputBaseFlags(o, f, t)
	checkStdinStreamFlags(f, o, p)
}

export function validateEffectiveOptionsImpl(e: ExtensionHostOptions, f: FlagOptions, o: OutputFormat): void {
	if (!isSupportedProvider(e.provider)) {
		fail(`Invalid provider: ${e.provider}; must be one of: ${supportedProviders.join(", ")}`)
	}
	if (!e.apiKey) {
		if (e.provider === "jabberwock") {
			failWithUsage(
				"Authentication with Jabberwock Cloud failed or was cancelled.",
				"Please run: jabberwock auth login",
			)
		}
		fail(`No API key provided. Use --api-key or set ${getEnvVarName(e.provider)}`)
	}
	if (!fs.existsSync(e.workspacePath)) {
		fail(`Workspace path does not exist: ${e.workspacePath}`)
	}
	if (e.reasoningEffort && !REASONING_EFFORTS.includes(e.reasoningEffort)) {
		fail(`Invalid reasoning effort: ${e.reasoningEffort}, must be one of: ${REASONING_EFFORTS.join(", ")}`)
	}
	if (!isValidOutputFormat(o)) {
		fail(`Invalid output format: ${f.outputFormat}; must be one of: text, json, stream-json`)
	}
}

export function validateEffectiveOptions(
	e: ExtensionHostOptions,
	f: FlagOptions,
	o: OutputFormat,
	t: boolean,
	p: string | undefined,
): void {
	validateEffectiveOptionsImpl(e, f, o)
	validateOutputFormatFlags(f, o, t, p)
}

export function validateRequiredFlags(f: FlagOptions, t: boolean, p: string | undefined, s: boolean, r: boolean): void {
	if (t) return
	if (p || s || r) {
		if (!f.print) {
			console.warn("[CLI] TUI disabled (no TTY support), falling back to print mode")
		}
		return
	}
	if (f.print) {
		failWithUsage("no prompt provided", "jabberwock --print [options] <prompt>")
	}
	failWithUsage("prompt is required in non-interactive mode", "jabberwock <prompt> [options]")
}

export function validateConsecutiveMistakeLimit(raw: string | number | undefined): number {
	const n = Number(raw)
	if (!Number.isInteger(n) || n < 0) {
		fail(`Invalid consecutive mistake limit: ${raw}; must be a non-negative integer`)
	}
	return n
}
