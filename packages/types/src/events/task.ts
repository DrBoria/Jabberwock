import { z } from "zod"

import { JabberwockEventName, jabberwockEventsSchema } from "./types.ts"

/**
 * TaskEvent
 */

export const taskEventSchema = z.discriminatedUnion("eventName", [
	// Task Provider Lifecycle
	z.object({
		eventName: z.literal(JabberwockEventName.TaskCreated),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskCreated],
		taskId: z.number().optional(),
	}),

	// Task Lifecycle
	z.object({
		eventName: z.literal(JabberwockEventName.TaskStarted),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskStarted],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskCompleted),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskCompleted],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskAborted),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskAborted],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskFocused),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskFocused],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskUnfocused),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskUnfocused],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskActive),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskActive],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskInteractive),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskInteractive],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskResumable),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskResumable],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskIdle),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskIdle],
		taskId: z.number().optional(),
	}),

	// Subtask Lifecycle
	z.object({
		eventName: z.literal(JabberwockEventName.TaskPaused),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskPaused],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskUnpaused),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskUnpaused],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskSpawned),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskSpawned],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskDelegated),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskDelegated],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskDelegationCompleted),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskDelegationCompleted],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskDelegationResumed),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskDelegationResumed],
		taskId: z.number().optional(),
	}),

	// Task Execution
	z.object({
		eventName: z.literal(JabberwockEventName.Message),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.Message],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskModeSwitched),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskModeSwitched],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskAskResponded),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskAskResponded],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.QueuedMessagesUpdated),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.QueuedMessagesUpdated],
		taskId: z.number().optional(),
	}),

	// Task Analytics
	z.object({
		eventName: z.literal(JabberwockEventName.TaskToolFailed),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskToolFailed],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.TaskTokenUsageUpdated),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.TaskTokenUsageUpdated],
		taskId: z.number().optional(),
	}),

	// Query Responses
	z.object({
		eventName: z.literal(JabberwockEventName.CommandsResponse),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.CommandsResponse],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.ModesResponse),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.ModesResponse],
		taskId: z.number().optional(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.ModelsResponse),
		payload: jabberwockEventsSchema.shape[JabberwockEventName.ModelsResponse],
		taskId: z.number().optional(),
	}),

	// Evals
	z.object({
		eventName: z.literal(JabberwockEventName.EvalPass),
		payload: z.undefined(),
		taskId: z.number(),
	}),
	z.object({
		eventName: z.literal(JabberwockEventName.EvalFail),
		payload: z.undefined(),
		taskId: z.number(),
	}),
])

export type TaskEvent = z.infer<typeof taskEventSchema>
