import { z } from "zod"

import { marketplaceItemSchema } from "./features/marketplace.ts"

export const checkoutDiffPayloadSchema = z.object({
	ts: z.number().optional(),
	previousCommitHash: z.string().optional(),
	commitHash: z.string(),
	mode: z.enum(["full", "checkpoint", "from-init", "to-current"]),
})

export type CheckpointDiffPayload = z.infer<typeof checkoutDiffPayloadSchema>

export const checkoutRestorePayloadSchema = z.object({
	ts: z.number(),
	commitHash: z.string(),
	mode: z.enum(["preview", "restore"]),
})

export type CheckpointRestorePayload = z.infer<typeof checkoutRestorePayloadSchema>

export interface IndexingStatusPayload {
	state: "Standby" | "Indexing" | "Indexed" | "Error" | "Stopping"
	message: string
}

export interface IndexClearedPayload {
	success: boolean
	error?: string
}

export const installMarketplaceItemWithParametersPayloadSchema = z.object({
	item: marketplaceItemSchema,
	parameters: z.record(z.string(), z.unknown()),
})

export type InstallMarketplaceItemWithParametersPayload = z.infer<
	typeof installMarketplaceItemWithParametersPayloadSchema
>

export type WebViewMessagePayload =
	| CheckpointDiffPayload
	| CheckpointRestorePayload
	| IndexingStatusPayload
	| IndexClearedPayload
	| InstallMarketplaceItemWithParametersPayload
	| import("./webview/message-types.ts").UpdateTodoListPayload
	| import("./webview/message-types.ts").EditQueuedMessagePayload

export interface IndexingStatus {
	systemStatus: string
	message?: string
	processedItems: number
	totalItems: number
	currentItemUnit?: string
	workspacePath?: string
	workspaceEnabled?: boolean
	autoEnableDefault?: boolean
}

export interface IndexingStatusUpdateMessage {
	type: "indexingStatusUpdate"
	values: IndexingStatus
}

export interface LanguageModelChatSelector {
	vendor?: string
	family?: string
	version?: string
	id?: string
}
