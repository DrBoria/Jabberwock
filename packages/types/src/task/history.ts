import { z } from "zod"

/**
 * Goal — a user-defined objective for the task
 * Each goal has a stable `id` across versions.
 * `id + version` uniquely identifies a specific version of a goal.
 */
export const goalSchema = z.object({
	id: z.string(), // stable identifier across versions
	text: z.string(), // goal text
	ts: z.number(), // timestamp (ms) when this version was created
	version: z.number(), // increments on each edit; id+version uniquely identifies this version
	importance: z.number().min(1).max(5).optional(), // 1-5, higher = more important
	order: z.number(), // display order in the list
})

export type Goal = z.infer<typeof goalSchema>

/**
 * HistoryItem
 */
export const historyItemSchema = z.object({
	id: z.string(),
	rootTaskId: z.string().optional(),
	parentTaskId: z.string().optional(),
	number: z.number(),
	ts: z.number(),
	task: z.string(),
	goals: z.array(goalSchema).optional(), // current active goals (latest versions)
	goalsHistory: z.array(goalSchema).optional(), // full versioned audit trail
	tokensIn: z.number(),
	tokensOut: z.number(),
	cacheWrites: z.number().optional(),
	cacheReads: z.number().optional(),
	totalCost: z.number(),
	size: z.number().optional(),
	workspace: z.string().optional(),
	mode: z.string().optional(),
	apiConfigName: z.string().optional(), // Provider profile name for sticky profile feature
	status: z.enum(["active", "completed", "delegated"]).optional(),
	delegatedToId: z.string().optional(), // Last child this parent delegated to
	childIds: z.array(z.string()).optional(), // All children spawned by this task
	awaitingChildId: z.string().optional(), // Child currently awaited (set when delegated)
	completedByChildId: z.string().optional(), // Child that completed and resumed this parent
	completionResultSummary: z.string().optional(), // Summary from completed child
})

export type HistoryItem = z.infer<typeof historyItemSchema>
