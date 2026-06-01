import { types, Instance, cast } from "mobx-state-tree"

import type {
	MarketplaceItem,
	InstallMarketplaceItemOptions,
	SkillMetadata,
	MarketplaceInstalledMetadata,
} from "@jabberwock/types"

import { vscode } from "@jabberwock/devtool/webview"
import type { WebviewMessage } from "@jabberwock/types"
import { eventConstants } from "@jabberwock/types"

/**
 * MarketplaceStore — tracks marketplace data and skills.
 */
export const MarketplaceStore = types
	.model("MarketplaceStore", {
		marketplaceItems: types.array(types.frozen<MarketplaceItem>()),
		marketplaceInstalledMetadata: types.frozen<MarketplaceInstalledMetadata>(),
		skills: types.array(types.frozen<SkillMetadata>()),
	})
	// ── Block 1: Data setters ──
	.actions((self) => ({
		setMarketplaceData(items: MarketplaceItem[], installedMetadata?: MarketplaceInstalledMetadata) {
			self.marketplaceItems.replace(items)
			if (installedMetadata !== undefined) {
				self.marketplaceInstalledMetadata = installedMetadata
			}
		},
		setSkills(skills: SkillMetadata[]) {
			self.skills = cast(skills)
		},
	}))
	// ── Block 2: Marketplace actions (formerly createMarketplaceActions) ──
	.actions((_self) => ({
		// ── Marketplace items ──────────────────────────────────────
		filterMarketplaceItems(filters?: { type?: string; search?: string; tags?: string[] }) {
			vscode.postMessage({
				type: eventConstants.MARKETPLACE.FILTER_MARKETPLACE_ITEMS,
				filters,
			} satisfies WebviewMessage)
		},

		fetchMarketplaceData() {
			vscode.postMessage({
				type: "fetchMarketplaceData" as const,
			} satisfies WebviewMessage)
		},

		installMarketplaceItem(mpItem: MarketplaceItem, mpInstallOptions: InstallMarketplaceItemOptions) {
			vscode.postMessage({
				type: "installMarketplaceItem" as const,
				mpItem,
				mpInstallOptions,
			} satisfies WebviewMessage)
		},

		removeInstalledMarketplaceItem(mpItem: MarketplaceItem, mpInstallOptions: InstallMarketplaceItemOptions) {
			vscode.postMessage({
				type: "removeInstalledMarketplaceItem" as const,
				mpItem,
				mpInstallOptions,
			} satisfies WebviewMessage)
		},

		// ── Skills ─────────────────────────────────────────────────
		requestSkills() {
			vscode.postMessage({
				type: eventConstants.MARKETPLACE.REQUEST_SKILLS,
			} satisfies WebviewMessage)
		},

		deleteSkill(skillName: string) {
			vscode.postMessage({
				type: eventConstants.MARKETPLACE.DELETE_SKILL,
				skillName,
			} satisfies WebviewMessage)
		},

		openSkillFile(skillName: string) {
			vscode.postMessage({
				type: eventConstants.MARKETPLACE.OPEN_SKILL_FILE,
				skillName,
			} satisfies WebviewMessage)
		},

		updateSkillModes(skillName: string, skillModeSlugs: string[] | undefined) {
			vscode.postMessage({
				type: eventConstants.MARKETPLACE.UPDATE_SKILL_MODES,
				skillName,
				skillModeSlugs,
			} satisfies WebviewMessage)
		},

		createSkill(skillName: string, fileContent?: string, modeSlugs?: string[] | undefined) {
			vscode.postMessage({
				type: eventConstants.MARKETPLACE.CREATE_SKILL,
				skillName,
				...(fileContent !== undefined && { fileContent }),
				...(modeSlugs !== undefined && { modeSlugs }),
			} satisfies WebviewMessage)
		},

		refreshCustomTools() {
			vscode.postMessage({
				type: eventConstants.MARKETPLACE.REFRESH_CUSTOM_TOOLS,
			} satisfies WebviewMessage)
		},

		// ── Upsells ────────────────────────────────────────────────
		getDismissedUpsells() {
			vscode.postMessage({
				type: eventConstants.SETTINGS.GET_DISMISSED_UPSELLS,
			} satisfies WebviewMessage)
		},

		dismissUpsell(upsellId: string) {
			vscode.postMessage({
				type: "dismissUpsell" as const,
				upsellId,
			} satisfies WebviewMessage)
		},
	}))

export type IMarketplaceStore = Instance<typeof MarketplaceStore>
// ── Instance is created by RootStore — do NOT create module-level singleton ──
// Dual instantiation would create two separate MST instances.
// Use `rootStore.marketplace` or `getRootStore().marketplace` instead.
