import { z } from "zod"

import { TelemetryEventName } from "./event-names.ts"
import { notificationSchema } from "../messages/notification.ts"
import { telemetryPropertiesSchema, telemetrySettingsSchema } from "./properties.ts"

export const jabberwockTelemetryEventSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.enum([
			TelemetryEventName.TASK_CREATED,
			TelemetryEventName.TASK_RESTARTED,
			TelemetryEventName.TASK_COMPLETED,
			TelemetryEventName.TASK_CONVERSATION_MESSAGE,
			TelemetryEventName.MODE_SWITCH,
			TelemetryEventName.MODE_SELECTOR_OPENED,
			TelemetryEventName.TOOL_USED,
			TelemetryEventName.CHECKPOINT_CREATED,
			TelemetryEventName.CHECKPOINT_RESTORED,
			TelemetryEventName.CHECKPOINT_DIFFED,
			TelemetryEventName.CODE_ACTION_USED,
			TelemetryEventName.PROMPT_ENHANCED,
			TelemetryEventName.TITLE_BUTTON_CLICKED,
			TelemetryEventName.AUTHENTICATION_INITIATED,
			TelemetryEventName.MARKETPLACE_ITEM_INSTALLED,
			TelemetryEventName.MARKETPLACE_ITEM_REMOVED,
			TelemetryEventName.MARKETPLACE_TAB_VIEWED,
			TelemetryEventName.MARKETPLACE_INSTALL_BUTTON_CLICKED,
			TelemetryEventName.SHARE_BUTTON_CLICKED,
			TelemetryEventName.SHARE_ORGANIZATION_CLICKED,
			TelemetryEventName.SHARE_PUBLIC_CLICKED,
			TelemetryEventName.SHARE_CONNECT_TO_CLOUD_CLICKED,
			TelemetryEventName.ACCOUNT_CONNECT_CLICKED,
			TelemetryEventName.ACCOUNT_CONNECT_SUCCESS,
			TelemetryEventName.ACCOUNT_LOGOUT_CLICKED,
			TelemetryEventName.ACCOUNT_LOGOUT_SUCCESS,
			TelemetryEventName.FEATURED_PROVIDER_CLICKED,
			TelemetryEventName.UPSELL_DISMISSED,
			TelemetryEventName.UPSELL_CLICKED,
			TelemetryEventName.SCHEMA_VALIDATION_ERROR,
			TelemetryEventName.DIFF_APPLICATION_ERROR,
			TelemetryEventName.SHELL_INTEGRATION_ERROR,
			TelemetryEventName.CONSECUTIVE_MISTAKE_ERROR,
			TelemetryEventName.CODE_INDEX_ERROR,
			TelemetryEventName.MODEL_CACHE_EMPTY_RESPONSE,
			TelemetryEventName.CONTEXT_CONDENSED,
			TelemetryEventName.SLIDING_WINDOW_TRUNCATION,
			TelemetryEventName.TAB_SHOWN,
			TelemetryEventName.MODE_SETTINGS_CHANGED,
			TelemetryEventName.CUSTOM_MODE_CREATED,
			TelemetryEventName.READ_FILE_LEGACY_FORMAT_USED,
		]),
		properties: telemetryPropertiesSchema,
	}),
	z.object({
		type: z.literal(TelemetryEventName.TELEMETRY_SETTINGS_CHANGED),
		properties: z.object({
			...telemetryPropertiesSchema.shape,
			previousSetting: telemetrySettingsSchema,
			newSetting: telemetrySettingsSchema,
		}),
	}),
	z.object({
		type: z.literal(TelemetryEventName.TASK_MESSAGE),
		properties: z.object({
			...telemetryPropertiesSchema.shape,
			taskId: z.string(),
			message: notificationSchema,
		}),
	}),
	z.object({
		type: z.literal(TelemetryEventName.LLM_COMPLETION),
		properties: z.object({
			...telemetryPropertiesSchema.shape,
			inputTokens: z.number(),
			outputTokens: z.number(),
			cacheReadTokens: z.number().optional(),
			cacheWriteTokens: z.number().optional(),
			cost: z.number().optional(),
		}),
	}),
])

export type JabberwockTelemetryEvent = z.infer<typeof jabberwockTelemetryEventSchema>
