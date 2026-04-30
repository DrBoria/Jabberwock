import { ContextCondense } from "@jabberwock/types"
import { ApiHandlerCreateMessageMetadata } from "../../../../../api"
import { buildNativeToolsArrayWithRestrictions } from "../../../../task/build-tools"
import { getEnvironmentDetails } from "../../../../environment/getEnvironmentDetails"
import { summarizeConversation } from "../../../../condense"
import { Task } from "../../../../task/Task"

/**
 * Condense the conversation context to reduce token usage.
 * Flushes pending tool results, summarizes the conversation,
 * and replaces the history with the condensed version.
 *
 * @param task - The Task instance
 */
export async function condenseContext(task: Task): Promise<void> {
	// CRITICAL: Flush any pending tool results before condensing
	// to ensure tool_use/tool_result pairs are complete in history
	await task.flushPendingToolResultsToHistory()

	const systemPrompt = await task.getSystemPrompt()

	// Get condensing configuration
	const state = await task.providerRef.deref()?.getState()
	const customCondensingPrompt = state?.customSupportPrompts?.CONDENSE
	const { mode, apiConfiguration } = state ?? {}

	const { contextTokens: prevContextTokens } = task.getTokenUsage()

	// Build tools for condensing metadata (same tools used for normal API calls)
	const provider = task.providerRef.deref()
	let allTools: import("openai").default.Chat.ChatCompletionTool[] = []
	if (provider) {
		const modelInfo = task.api.getModel().info
		const toolsResult = await buildNativeToolsArrayWithRestrictions({
			provider,
			cwd: task.cwd,
			mode,
			customModes: state?.customModes,
			experiments: state?.experiments,
			apiConfiguration,
			disabledTools: state?.disabledTools,
			modelInfo,
			includeAllToolsWithRestrictions: false,
		})
		allTools = toolsResult.tools
	}

	// Build metadata with tools and taskId for the condensing API call
	const metadata: ApiHandlerCreateMessageMetadata = {
		mode,
		taskId: task.taskId,
		...(allTools.length > 0
			? {
					tools: allTools,
					tool_choice: "auto",
					parallelToolCalls: true,
				}
			: {}),
	}
	// Generate environment details to include in the condensed summary
	const environmentDetails = await getEnvironmentDetails(task, true)

	const filesReadByJabberwock = await task.getFilesReadByJabberwockSafely("condenseContext")

	const {
		messages,
		summary,
		cost,
		newContextTokens = 0,
		error,
		errorDetails,
		condenseId,
	} = await summarizeConversation({
		messages: task.apiConversationHistory,
		apiHandler: task.api,
		systemPrompt,
		taskId: task.taskId,
		isAutomaticTrigger: false,
		customCondensingPrompt,
		metadata,
		environmentDetails,
		filesReadByJabberwock,
		cwd: task.cwd,
		jabberwockIgnoreController: task.jabberwockIgnoreController,
	})
	if (error) {
		await task.say(
			"condense_context_error",
			error,
			undefined /* images */,
			false /* partial */,
			undefined /* checkpoint */,
			undefined /* progressStatus */,
			{ isNonInteractive: true } /* options */,
		)
		return
	}
	await task.overwriteApiConversationHistory(messages)

	const contextCondense: ContextCondense = {
		summary,
		cost,
		newContextTokens,
		prevContextTokens,
		condenseId: condenseId!,
	}
	await task.say(
		"condense_context",
		undefined /* text */,
		undefined /* images */,
		false /* partial */,
		undefined /* checkpoint */,
		undefined /* progressStatus */,
		{ isNonInteractive: true } /* options */,
		contextCondense,
	)

	// Process any queued messages after condensing completes
	task.processQueuedMessages()
}
