import { z } from "zod"

import { JabberwockEventName } from "../events/types.ts"
import { notificationSchema } from "../messages/notification.ts"

/**
 * TaskBridgeEvent
 */

export enum TaskBridgeEventName {
	Message = JabberwockEventName.Message,
	TaskModeSwitched = JabberwockEventName.TaskModeSwitched,
	TaskInteractive = JabberwockEventName.TaskInteractive,
}

export const taskBridgeEventSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal(TaskBridgeEventName.Message),
		taskId: z.string(),
		action: z.string(),
		message: notificationSchema,
	}),
	z.object({
		type: z.literal(TaskBridgeEventName.TaskModeSwitched),
		taskId: z.string(),
		mode: z.string(),
	}),
	z.object({
		type: z.literal(TaskBridgeEventName.TaskInteractive),
		taskId: z.string(),
	}),
])

export type TaskBridgeEvent = z.infer<typeof taskBridgeEventSchema>

/**
 * TaskBridgeCommand
 */

export enum TaskBridgeCommandName {
	Message = "message",
	ApproveAsk = "approve_ask",
	DenyAsk = "deny_ask",
}

export const taskBridgeCommandSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal(TaskBridgeCommandName.Message),
		taskId: z.string(),
		payload: z.object({
			text: z.string(),
			images: z.array(z.string()).optional(),
			mode: z.string().optional(),
			providerProfile: z.string().optional(),
		}),
		timestamp: z.number(),
	}),
	z.object({
		type: z.literal(TaskBridgeCommandName.ApproveAsk),
		taskId: z.string(),
		payload: z.object({
			text: z.string().optional(),
			images: z.array(z.string()).optional(),
		}),
		timestamp: z.number(),
	}),
	z.object({
		type: z.literal(TaskBridgeCommandName.DenyAsk),
		taskId: z.string(),
		payload: z.object({
			text: z.string().optional(),
			images: z.array(z.string()).optional(),
		}),
		timestamp: z.number(),
	}),
])

export type TaskBridgeCommand = z.infer<typeof taskBridgeCommandSchema>

/**
 * ExtensionSocketEvents
 */

export enum ExtensionSocketEvents {
	CONNECTED = "extension:connected",

	REGISTER = "extension:register",
	UNREGISTER = "extension:unregister",

	HEARTBEAT = "extension:heartbeat",

	EVENT = "extension:event", // event from extension instance
	RELAYED_EVENT = "extension:relayed_event", // relay from server

	COMMAND = "extension:command", // command from user
	RELAYED_COMMAND = "extension:relayed_command", // relay from server
}

/**
 * TaskSocketEvents
 */

export enum TaskSocketEvents {
	JOIN = "task:join",
	LEAVE = "task:leave",

	EVENT = "task:event", // event from extension task
	RELAYED_EVENT = "task:relayed_event", // relay from server

	COMMAND = "task:command", // command from user
	RELAYED_COMMAND = "task:relayed_command", // relay from server
}
