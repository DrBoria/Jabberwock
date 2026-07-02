import { z } from "zod"

import { TaskStatus, taskMetadataSchema } from "../task/task.ts"
import { notificationSchema } from "../messages/notification.ts"
import { queuedMessageSchema, tokenUsageSchema } from "../messages/types.ts"
import { staticAppPropertiesSchema, gitPropertiesSchema } from "../telemetry/properties.ts"

/**
 * ShareResponse
 */

export const shareResponseSchema = z.object({
	success: z.boolean(),
	shareUrl: z.string().optional(),
	error: z.string().optional(),
	isNewShare: z.boolean().optional(),
	manageUrl: z.string().optional(),
})

export type ShareResponse = z.infer<typeof shareResponseSchema>

/**
 * ExtensionTask
 */

const extensionTaskSchema = z.object({
	taskId: z.string(),
	taskStatus: z.nativeEnum(TaskStatus),
	taskAsk: notificationSchema.optional(),
	queuedMessages: z.array(queuedMessageSchema).optional(),
	parentTaskId: z.string().optional(),
	childTaskId: z.string().optional(),
	tokenUsage: tokenUsageSchema.optional(),
	...taskMetadataSchema.shape,
})

export type ExtensionTask = z.infer<typeof extensionTaskSchema>

/**
 * ExtensionInstance
 */

export const extensionInstanceSchema = z.object({
	instanceId: z.string(),
	userId: z.string(),
	workspacePath: z.string(),
	appProperties: staticAppPropertiesSchema,
	gitProperties: gitPropertiesSchema.optional(),
	lastHeartbeat: z.coerce.number(),
	task: extensionTaskSchema,
	taskAsk: notificationSchema.optional(),
	taskHistory: z.array(z.string()),
	mode: z.string().optional(),
	modes: z.array(z.object({ slug: z.string(), name: z.string() })).optional(),
	providerProfile: z.string().optional(),
	providerProfiles: z.array(z.object({ name: z.string(), provider: z.string().optional() })).optional(),
	isCloudAgent: z.boolean().optional(),
})

export type ExtensionInstance = z.infer<typeof extensionInstanceSchema>

/**
 * UsageStats
 */

export const usageStatsSchema = z.object({
	success: z.boolean(),
	data: z.object({
		dates: z.array(z.string()),
		tasks: z.array(z.number()),
		tokens: z.array(z.number()),
		costs: z.array(z.number()),
		totals: z.object({
			tasks: z.number(),
			tokens: z.number(),
			cost: z.number(),
		}),
	}),
	period: z.number(),
})

export type UsageStats = z.infer<typeof usageStatsSchema>
