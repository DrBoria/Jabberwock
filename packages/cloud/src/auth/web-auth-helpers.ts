import crypto from "crypto"

import type { ExtensionContext } from "vscode"

import { getJabberwockApiUrl } from "../config.ts"
import { importVscode } from "../importVscode.ts"
import { authCredentialsSchema } from "./web-auth-schemas.ts"
import type { AuthCredentials } from "./web-auth-schemas.ts"
import { clerkSignIn as clerkSignInHelper, clerkLogout as clerkLogoutHelper } from "./clerk-api.ts"
import type { ClerkApiDependencies } from "./clerk-api-enrichment.ts"
import { ZodError } from "zod"

const AUTH_STATE_KEY = "clerk-auth-state"

export function buildLoginUrl(
	context: ExtensionContext,
	vscode: NonNullable<Awaited<ReturnType<typeof importVscode>>>,
	landingPageSlug?: string,
	useProviderSignup?: boolean,
): string {
	const state = crypto.randomBytes(16).toString("hex")
	context.globalState.update(AUTH_STATE_KEY, state)
	const packageJSON = context.extension?.packageJSON
	const publisher = packageJSON?.publisher ?? "RooVeterinaryInc"
	const name = packageJSON?.name ?? "jabberwock"
	const params = new URLSearchParams({
		state,
		auth_redirect: `${vscode.env.uriScheme}://${publisher}.${name}`,
	})

	if (landingPageSlug) {
		return `${getJabberwockApiUrl()}/l/${landingPageSlug}?${params.toString()}`
	}

	if (useProviderSignup) {
		return `${getJabberwockApiUrl()}/extension/provider-sign-up?${params.toString()}`
	}

	return `${getJabberwockApiUrl()}/extension/sign-in?${params.toString()}`
}

export function buildLoginErrorContext(landingPageSlug?: string): string {
	return landingPageSlug ? ` (landing page: ${landingPageSlug})` : ""
}

export async function storeCredentials(
	context: ExtensionContext,
	key: string,
	credentials: AuthCredentials,
): Promise<void> {
	await context.secrets.store(key, JSON.stringify(credentials))
}

export async function loadCredentials(
	context: ExtensionContext,
	key: string,
	userInfo: { organizationId?: string | null } | null,
	log: (...args: unknown[]) => void,
): Promise<AuthCredentials | null> {
	const credentialsJson = await context.secrets.get(key)
	if (!credentialsJson) return null

	try {
		const parsedJson = JSON.parse(credentialsJson)
		const credentials = authCredentialsSchema.parse(parsedJson)

		if (credentials.organizationId === undefined && userInfo?.organizationId) {
			credentials.organizationId = userInfo.organizationId
			await storeCredentials(context, key, credentials)
			log("[auth] Migrated credentials with organizationId")
		}

		return credentials
	} catch (error) {
		if (error instanceof ZodError) {
			log("[auth] Invalid credentials format:", error.errors)
		} else {
			log("[auth] Failed to parse stored credentials:", error)
		}
		return null
	}
}

export async function clearCredentials(context: ExtensionContext, key: string): Promise<void> {
	await context.secrets.delete(key)
}

export async function initiateLogin(
	context: ExtensionContext,
	log: (...args: unknown[]) => void,
	landingPageSlug?: string,
	useProviderSignup?: boolean,
): Promise<void> {
	try {
		const vscode = await importVscode()

		if (!vscode) {
			throw new Error("VS Code API not available")
		}

		const url = buildLoginUrl(context, vscode, landingPageSlug, useProviderSignup)
		await vscode.env.openExternal(vscode.Uri.parse(url))
	} catch (error) {
		const errorContext = buildLoginErrorContext(landingPageSlug)
		log(`[auth] Error initiating Jabberwock Cloud auth${errorContext}: ${error}`)
		throw new Error(`Failed to initiate Jabberwock Cloud authentication${errorContext}: ${error}`)
	}
}

export async function handleAuthCallback(
	context: ExtensionContext,
	code: string | null,
	state: string | null,
	log: (...args: unknown[]) => void,
	getClerkApiDeps: () => ClerkApiDependencies,
	credentialsKey: string,
	organizationId?: string | null,
	providerModel?: string | null,
): Promise<void> {
	if (!code || !state) {
		const vscode = await importVscode()

		if (vscode) {
			vscode.window.showInformationMessage("Invalid Jabberwock Cloud sign in url")
		}

		return
	}

	try {
		const storedState = context.globalState.get<string>(AUTH_STATE_KEY)

		if (state !== storedState) {
			log("[auth] State mismatch in callback")
			throw new Error("Invalid state parameter. Authentication request may have been tampered with.")
		}

		const credentials = await clerkSignInHelper(code, getClerkApiDeps())

		credentials.organizationId = organizationId || null

		await storeCredentials(context, credentialsKey, credentials)

		if (providerModel) {
			await context.globalState.update("jabberwock-provider-model", providerModel)
			await context.globalState.update("jabberwock-auth-skip-model", undefined)
			log(`[auth] Stored provider model: ${providerModel}`)
		} else {
			await context.globalState.update("jabberwock-auth-skip-model", true)
			log(`[auth] No provider model selected during signup`)
		}

		const vscode = await importVscode()

		if (vscode) {
			vscode.window.showInformationMessage("Successfully authenticated with Jabberwock Cloud")
		}

		log("[auth] Successfully authenticated with Jabberwock Cloud")
	} catch (error) {
		log(`[auth] Error handling Jabberwock Cloud callback: ${error}`)
		throw new Error(`Failed to handle Jabberwock Cloud callback: ${error}`)
	}
}

export async function performLogout(
	context: ExtensionContext,
	credentialsKey: string,
	credentials: AuthCredentials | null,
	getClerkApiDeps: () => ClerkApiDependencies,
	log: (...args: unknown[]) => void,
): Promise<void> {
	try {
		await clearCredentials(context, credentialsKey)
		await context.globalState.update(AUTH_STATE_KEY, undefined)

		if (credentials) {
			try {
				await clerkLogoutHelper(credentials, getClerkApiDeps())
			} catch (error) {
				log("[auth] Error calling clerkLogout:", error)
			}
		}

		const vscode = await importVscode()

		if (vscode) {
			vscode.window.showInformationMessage("Logged out from Jabberwock Cloud")
		}

		log("[auth] Logged out from Jabberwock Cloud")
	} catch (error) {
		log(`[auth] Error logging out from Jabberwock Cloud: ${error}`)
		throw new Error(`Failed to log out from Jabberwock Cloud: ${error}`)
	}
}
