import type { IntentBus } from "../../../intents/bus"
import { IntentConstants } from "@intentConstants"
import type { IntentHandlerContext } from "../../../intents/context"
import { getRootStore } from "../../../root-store"
import type { CloudOrganizationMembership } from "@jabberwock/types"

/**
 * Register all frontend cloud event handlers on the IntentBus.
 */
export function registerOnFrontendCloudIntents(bus: IntentBus): void {
	bus.register(IntentConstants.cloud.AUTH_CHANGED, async (intent, _ctx: IntentHandlerContext) => {
		const store = getRootStore()
		const payload = intent.payload as {
			cloudIsAuthenticated?: boolean
			cloudOrganizations?: unknown[]
			sharingEnabled?: boolean
			publicSharingEnabled?: boolean
		}
		if (payload.cloudIsAuthenticated !== undefined) {
			store.cloud.setCloudIsAuthenticated(payload.cloudIsAuthenticated)
		}
		if (payload.cloudOrganizations !== undefined) {
			store.cloud.setCloudOrganizations(payload.cloudOrganizations as CloudOrganizationMembership[])
		}
		if (payload.sharingEnabled !== undefined) {
			store.cloud.setSharingEnabled(payload.sharingEnabled)
		}
		if (payload.publicSharingEnabled !== undefined) {
			store.cloud.setPublicSharingEnabled(payload.publicSharingEnabled)
		}
	})
}
