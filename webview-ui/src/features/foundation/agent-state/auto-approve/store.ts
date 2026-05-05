import { types, Instance } from "mobx-state-tree"

/**
 * AutoApproveStore — tracks auto-approval settings.
 * Receives snapshots from the extension-side store via MstBridge.
 */
export const AutoApproveStore = types.model("AutoApproveStore", {
	autoApproveSettings: types.optional(types.frozen<Record<string, boolean>>(), {}),
	isAutoApprovalEnabled: false,
})

export type IAutoApproveStore = Instance<typeof AutoApproveStore>
