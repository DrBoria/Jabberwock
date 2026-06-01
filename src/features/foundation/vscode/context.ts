import * as vscode from "vscode"

import {
	GLOBAL_STATE_KEYS,
	SECRET_STATE_KEYS,
	GLOBAL_SECRET_KEYS,
	type GlobalState,
	type SecretState,
} from "@jabberwock/types"

import { logger } from "../../../utils/logging"

// ─── Helpers ──────────────────────────────────────────────────────────

type GlobalStateKey = keyof GlobalState
type SecretStateKey = keyof SecretState

export const PASS_THROUGH_STATE_KEYS = ["taskHistory"]

export const isPassThroughStateKey = (key: string) => PASS_THROUGH_STATE_KEYS.includes(key)

// ─── Module-level singleton state ─────────────────────────────────────

let _ctx: vscode.ExtensionContext | null = null
let _stateCache: GlobalState = {}
let _secretCache: SecretState = {}
let _isInitialized = false

// ─── Public type ──────────────────────────────────────────────────────

export interface VscodeContextAccess {
	readonly extensionUri: vscode.Uri
	readonly extensionPath: string
	readonly globalStorageUri: vscode.Uri
	readonly logUri: vscode.Uri
	readonly extension: vscode.Extension<unknown>
	readonly extensionMode: vscode.ExtensionMode
	readonly extensionContext: vscode.ExtensionContext

	// Global state (VS Code globalState)
	getGlobalState<K extends GlobalStateKey>(key: K, defaultValue?: GlobalState[K]): GlobalState[K]
	updateGlobalState<K extends GlobalStateKey>(key: K, value: GlobalState[K]): Promise<void>

	// Secrets (VS Code secrets API)
	getSecret(key: SecretStateKey): string | undefined
	storeSecret(key: SecretStateKey, value?: string): Promise<void>
	refreshSecrets(): Promise<void>
}

// ─── Initialization ───────────────────────────────────────────────────

/**
 * Initialize the VS Code context accessor with an ExtensionContext.
 * Called once during extension activation.
 */
export function initVscodeContext(context: vscode.ExtensionContext): void {
	_ctx = context
	_stateCache = {}
	_secretCache = {}
	_isInitialized = false

	// Load global state
	for (const key of GLOBAL_STATE_KEYS) {
		try {
			_stateCache[key] = context.globalState.get(key)
		} catch (error) {
			logger.error(`Error loading global ${key}: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	// Load secrets
	const promises = [
		...SECRET_STATE_KEYS.map(async (key) => {
			try {
				_secretCache[key] = await context.secrets.get(key)
			} catch (error) {
				logger.error(`Error loading secret ${key}: ${error instanceof Error ? error.message : String(error)}`)
			}
		}),
		...GLOBAL_SECRET_KEYS.map(async (key) => {
			try {
				_secretCache[key] = await context.secrets.get(key)
			} catch (error) {
				logger.error(
					`Error loading global secret ${key}: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}),
	]

	// Fire-and-forget initialization — secrets loaded in background
	void Promise.all(promises).then(() => {
		_isInitialized = true
	})
}

// ─── Accessor ─────────────────────────────────────────────────────────

export function getVscodeContext(): VscodeContextAccess {
	if (!_ctx) {
		throw new Error("VscodeContext not initialized — call initVscodeContext(context) first")
	}

	return {
		get extensionUri() {
			return _ctx!.extensionUri
		},

		get extensionPath() {
			return _ctx!.extensionPath
		},

		get globalStorageUri() {
			return _ctx!.globalStorageUri
		},

		get logUri() {
			return _ctx!.logUri
		},

		get extension() {
			return _ctx!.extension
		},

		get extensionMode() {
			return _ctx!.extensionMode
		},

		get extensionContext(): vscode.ExtensionContext {
			return _ctx!
		},

		// ─── Global State ────────────────────────────────────────

		getGlobalState<K extends GlobalStateKey>(key: K, defaultValue?: GlobalState[K]): GlobalState[K] {
			if (isPassThroughStateKey(key)) {
				const value = _ctx!.globalState.get<GlobalState[K]>(key)
				return value === undefined || value === null ? (defaultValue as GlobalState[K]) : value
			}

			const value = _stateCache[key]
			return value !== undefined ? value : (defaultValue as GlobalState[K])
		},

		updateGlobalState<K extends GlobalStateKey>(key: K, value: GlobalState[K]): Promise<void> {
			if (isPassThroughStateKey(key)) {
				return Promise.resolve(_ctx!.globalState.update(key, value)) as Promise<void>
			}

			_stateCache[key] = value
			return Promise.resolve(_ctx!.globalState.update(key, value)) as Promise<void>
		},

		// ─── Secrets ─────────────────────────────────────────────

		getSecret(key: SecretStateKey) {
			return _secretCache[key]
		},

		storeSecret(key: SecretStateKey, value?: string): Promise<void> {
			_secretCache[key] = value
			return Promise.resolve(
				value === undefined ? _ctx!.secrets.delete(key) : _ctx!.secrets.store(key, value),
			) as Promise<void>
		},

		async refreshSecrets(): Promise<void> {
			const promises = [
				...SECRET_STATE_KEYS.map(async (key) => {
					try {
						_secretCache[key] = await _ctx!.secrets.get(key)
					} catch (error) {
						logger.error(
							`Error refreshing secret ${key}: ${error instanceof Error ? error.message : String(error)}`,
						)
					}
				}),
				...GLOBAL_SECRET_KEYS.map(async (key) => {
					try {
						_secretCache[key] = await _ctx!.secrets.get(key)
					} catch (error) {
						logger.error(
							`Error refreshing global secret ${key}: ${error instanceof Error ? error.message : String(error)}`,
						)
					}
				}),
			]
			await Promise.all(promises)
		},
	}
}
