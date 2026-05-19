import { types, Instance } from "mobx-state-tree"

import { vscode } from "@jabberwock/devtool/react"
import type { WebviewMessage, CloudOrganizationMembership } from "@jabberwock/types"
import {
	CHAT_TASK_TASK_SYNC_ENABLED,
	CLOUD_CLEAR_CLOUD_AUTH_SKIP_MODEL,
	CLOUD_JABBERWOCK_CLOUD_MANUAL_URL,
	CLOUD_JABBERWOCK_CLOUD_SIGN_IN,
	CLOUD_JABBERWOCK_CLOUD_SIGN_OUT,
	CLOUD_OPEN_AI_CODEX_SIGN_IN,
	CLOUD_OPEN_AI_CODEX_SIGN_OUT,
} from "@jabberwock/types"

/**
 * CloudStore — manages cloud authentication state, organization switching,
 * and image saving. Owned by RootStore as a sub-store.
 */
export const CloudStore = types
	.model("CloudStore", {
		cloudIsAuthenticated: types.boolean,
		cloudOrganizations: types.frozen<CloudOrganizationMembership[]>(),
		sharingEnabled: types.boolean,
		publicSharingEnabled: types.boolean,
		prevCloudIsAuthenticated: types.boolean,
	})
	// ── Block 1: Data setters ────────────────────────────────────────────
	.actions((self) => ({
		setCloudIsAuthenticated(value: boolean) {
			self.cloudIsAuthenticated = value
		},
		setCloudOrganizations(value: CloudOrganizationMembership[]) {
			self.cloudOrganizations = value
		},
		setSharingEnabled(value: boolean) {
			self.sharingEnabled = value
		},
		setPublicSharingEnabled(value: boolean) {
			self.publicSharingEnabled = value
		},
		setPrevCloudIsAuthenticated(value: boolean) {
			self.prevCloudIsAuthenticated = value
		},
	}))
	// ── Block 2: Cloud actions (formerly createCloudActions) ─────────────
	.actions((_self) => ({
		// ── Cloud sign in ──────────────────────────────────────────
		cloudSignIn(useProviderSignup?: boolean) {
			vscode.postMessage({
				type: CLOUD_JABBERWOCK_CLOUD_SIGN_IN,
				...(useProviderSignup !== undefined && { useProviderSignup }),
			} satisfies WebviewMessage)
		},

		// ── Cloud sign out ─────────────────────────────────────────
		cloudSignOut() {
			vscode.postMessage({
				type: CLOUD_JABBERWOCK_CLOUD_SIGN_OUT,
			} satisfies WebviewMessage)
		},

		// ── Cloud manual URL ───────────────────────────────────────
		cloudManualUrl(text: string) {
			vscode.postMessage({
				type: CLOUD_JABBERWOCK_CLOUD_MANUAL_URL,
				text,
			} satisfies WebviewMessage)
		},

		// ── Clear auth skip model ──────────────────────────────────
		clearAuthSkipModel() {
			vscode.postMessage({
				type: CLOUD_CLEAR_CLOUD_AUTH_SKIP_MODEL,
			} satisfies WebviewMessage)
		},

		// ── OpenAI Codex sign in ───────────────────────────────────
		openaiCodexSignIn() {
			vscode.postMessage({
				type: CLOUD_OPEN_AI_CODEX_SIGN_IN,
			} satisfies WebviewMessage)
		},

		// ── OpenAI Codex sign out ──────────────────────────────────
		openaiCodexSignOut() {
			vscode.postMessage({
				type: CLOUD_OPEN_AI_CODEX_SIGN_OUT,
			} satisfies WebviewMessage)
		},

		// ── Switch organization ────────────────────────────────────
		switchOrganization(organizationId: string | null) {
			vscode.postMessage({
				type: "switchOrganization" as const,
				organizationId,
			} satisfies WebviewMessage)
		},

		// ── Save image ─────────────────────────────────────────────
		saveImage(dataUri: string) {
			vscode.postMessage({
				type: "saveImage" as const,
				dataUri,
			} satisfies WebviewMessage)
		},

		// ── Task sync enabled ────────────────────────────────────────
		taskSyncEnabled(bool: boolean) {
			vscode.postMessage({
				type: CHAT_TASK_TASK_SYNC_ENABLED,
				bool,
			} satisfies WebviewMessage)
		},
	}))

export type ICloudStore = Instance<typeof CloudStore>
export const cloudStore = CloudStore.create({
	cloudIsAuthenticated: false,
	cloudOrganizations: [],
	sharingEnabled: false,
	publicSharingEnabled: false,
	prevCloudIsAuthenticated: false,
})
