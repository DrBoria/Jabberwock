import * as vscode from "vscode"

import { SECRET_STATE_KEYS, GLOBAL_SECRET_KEYS } from "@jabberwock/types"

export const PASS_THROUGH_STATE_KEYS = ["taskHistory"]

// ─── VscodeContextAccess Interface ───────────────────────────────────────

export interface VscodeContextAccess {
	extensionContext: vscode.ExtensionContext
	extensionUri: vscode.Uri
	extensionMode: vscode.ExtensionMode
	globalStorageUri: vscode.Uri
	getGlobalState<T = unknown>(key: string): T | undefined
	updateGlobalState(key: string, value: unknown): Thenable<void>
	getSecret(key: string): string | undefined
	storeSecret(key: string, value: string | undefined): Promise<void>
	refreshSecrets(): Promise<void>
}

// ─── Module State ────────────────────────────────────────────────────────

let _extensionContext: vscode.ExtensionContext | undefined
let _secretsCache = new Map<string, string | undefined>()

// ─── initVscodeContext ──────────────────────────────────────────────────

export function initVscodeContext(context: vscode.ExtensionContext): void {
	_extensionContext = context
}

// ─── getVscodeContext ───────────────────────────────────────────────────

export function getVscodeContext(): VscodeContextAccess {
	if (!_extensionContext) {
		throw new Error("VscodeContext not initialized. Call initVscodeContext() first.")
	}

	const ctx = _extensionContext

	return {
		get extensionContext() {
			return ctx
		},
		get extensionUri() {
			return ctx.extensionUri
		},
		get extensionMode() {
			return ctx.extensionMode
		},
		get globalStorageUri() {
			return ctx.globalStorageUri
		},

		getGlobalState<T>(key: string): T | undefined {
			return ctx.globalState.get<T>(key)
		},

		updateGlobalState(key: string, value: unknown): Thenable<void> {
			return ctx.globalState.update(key, value)
		},

		getSecret(key: string): string | undefined {
			return _secretsCache.get(key)
		},

		async storeSecret(key: string, value: string | undefined): Promise<void> {
			_secretsCache.set(key, value)
			if (value === undefined) {
				await ctx.secrets.delete(key)
			} else {
				await ctx.secrets.store(key, value)
			}
		},

		async refreshSecrets(): Promise<void> {
			const allSecretKeys = [...SECRET_STATE_KEYS, ...GLOBAL_SECRET_KEYS]
			await Promise.all(
				allSecretKeys.map(async (key) => {
					const value = await ctx.secrets.get(key)
					_secretsCache.set(key, value ?? undefined)
				}),
			)
		},
	}
}
