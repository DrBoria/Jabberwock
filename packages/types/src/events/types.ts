import { z } from "zod"

import { notificationSchema } from "../messages/notification.ts"
import { queuedMessageSchema, tokenUsageSchema } from "../messages/types.ts"
import { modelInfoSchema } from "../models/model.ts"
import { toolNamesSchema, toolUsageSchema } from "../tool/tool.ts"

/**
 * JabberwockEventName
 */

export enum JabberwockEventName {
	// Task Provider Lifecycle
	TaskCreated = "taskCreated",

	// Task Lifecycle
	TaskStarted = "taskStarted",
	TaskCompleted = "taskCompleted",
	TaskAborted = "taskAborted",
	TaskFocused = "taskFocused",
	TaskUnfocused = "taskUnfocused",
	TaskActive = "taskActive",
	TaskInteractive = "taskInteractive",
	TaskResumable = "taskResumable",
	TaskIdle = "taskIdle",

	// Subtask Lifecycle
	TaskPaused = "taskPaused",
	TaskUnpaused = "taskUnpaused",
	TaskSpawned = "taskSpawned",
	TaskDelegated = "taskDelegated",
	TaskDelegationCompleted = "taskDelegationCompleted",
	TaskDelegationResumed = "taskDelegationResumed",

	// Task Execution
	Message = "message",
	TaskModeSwitched = "taskModeSwitched",
	TaskAskResponded = "taskAskResponded",
	TaskUserMessage = "taskUserMessage",
	QueuedMessagesUpdated = "queuedMessagesUpdated",

	// Task Analytics
	TaskTokenUsageUpdated = "taskTokenUsageUpdated",
	TaskToolFailed = "taskToolFailed",

	// Configuration Changes
	ModeChanged = "modeChanged",
	ProviderProfileChanged = "providerProfileChanged",

	// Query Responses
	CommandsResponse = "commandsResponse",
	ModesResponse = "modesResponse",
	ModelsResponse = "modelsResponse",

	// Evals
	EvalPass = "evalPass",
	EvalFail = "evalFail",
}

/**
 * JabberwockEvents
 */

export const jabberwockEventsSchema = z.object({
	[JabberwockEventName.TaskCreated]: z.tuple([z.string()]),

	[JabberwockEventName.TaskStarted]: z.tuple([z.string()]),
	[JabberwockEventName.TaskCompleted]: z.tuple([
		z.string(),
		tokenUsageSchema,
		toolUsageSchema,
		z.object({
			isSubtask: z.boolean(),
		}),
	]),
	[JabberwockEventName.TaskAborted]: z.tuple([z.string()]),
	[JabberwockEventName.TaskFocused]: z.tuple([z.string()]),
	[JabberwockEventName.TaskUnfocused]: z.tuple([z.string()]),
	[JabberwockEventName.TaskActive]: z.tuple([z.string()]),
	[JabberwockEventName.TaskInteractive]: z.tuple([z.string()]),
	[JabberwockEventName.TaskResumable]: z.tuple([z.string()]),
	[JabberwockEventName.TaskIdle]: z.tuple([z.string()]),

	[JabberwockEventName.TaskPaused]: z.tuple([z.string()]),
	[JabberwockEventName.TaskUnpaused]: z.tuple([z.string()]),
	[JabberwockEventName.TaskSpawned]: z.tuple([z.string(), z.string()]),
	[JabberwockEventName.TaskDelegated]: z.tuple([
		z.string(), // parentTaskId
		z.string(), // childTaskId
	]),
	[JabberwockEventName.TaskDelegationCompleted]: z.tuple([
		z.string(), // parentTaskId
		z.string(), // childTaskId
		z.string(), // completionResultSummary
	]),
	[JabberwockEventName.TaskDelegationResumed]: z.tuple([
		z.string(), // parentTaskId
		z.string(), // childTaskId
	]),

	[JabberwockEventName.Message]: z.tuple([
		z.object({
			taskId: z.string(),
			action: z.union([z.literal("created"), z.literal("updated")]),
			message: notificationSchema,
		}),
	]),
	[JabberwockEventName.TaskModeSwitched]: z.tuple([z.string(), z.string()]),
	[JabberwockEventName.TaskAskResponded]: z.tuple([z.string()]),
	[JabberwockEventName.TaskUserMessage]: z.tuple([z.string()]),
	[JabberwockEventName.QueuedMessagesUpdated]: z.tuple([z.string(), z.array(queuedMessageSchema)]),

	[JabberwockEventName.TaskToolFailed]: z.tuple([z.string(), toolNamesSchema, z.string()]),
	[JabberwockEventName.TaskTokenUsageUpdated]: z.tuple([z.string(), tokenUsageSchema, toolUsageSchema]),

	[JabberwockEventName.ModeChanged]: z.tuple([z.string()]),
	[JabberwockEventName.ProviderProfileChanged]: z.tuple([z.object({ name: z.string(), provider: z.string() })]),

	[JabberwockEventName.CommandsResponse]: z.tuple([
		z.array(
			z.object({
				name: z.string(),
				source: z.enum(["global", "project", "built-in"]),
				filePath: z.string().optional(),
				description: z.string().optional(),
				argumentHint: z.string().optional(),
			}),
		),
	]),
	[JabberwockEventName.ModesResponse]: z.tuple([z.array(z.object({ slug: z.string(), name: z.string() }))]),
	[JabberwockEventName.ModelsResponse]: z.tuple([z.record(z.string(), modelInfoSchema)]),
})

export type JabberwockEvents = z.infer<typeof jabberwockEventsSchema>
