import { Anthropic } from "@anthropic-ai/sdk"
import { ConsecutiveMistakeError, getModelId } from "@jabberwock/types"
import { getTelemetryService } from "@jabberwock/telemetry"
import { t } from "@i18n"
import { formatResponse } from "@features/settings/context/responses"
import { getModeBySlug } from "@shared/modes"
import type { ITaskModel } from "@features/chat/task/store"
import type { IBackendRootStore } from "@features/store"
import { diagnosticsManager } from "@jabberwock/devtool"
import { getEnvironmentDetails } from "@features/chat/task/condense/actions/condenseContext"
import { processUserContentMentions } from "@features/chat/task/messages/actions/mentions/processUserContentMentions"
import type { TaskDelegate } from "@features/chat/task/condense/actions/types"
import { handleModeSwitch } from "@features/foundation/window-manager/store"
import { getSkillsManager } from "@features/settings/skills/store"
import { getFileContextTracker } from "@features/foundation/time-machine/actions/getTimeMachine"
import { ask } from "@features/chat/task/notifications/actions/ask"
import { agentBroadcast } from "@features/chat/task/messages/actions/say"
import { getProvider } from "@features/foundation/webview/providerRegistry"

export async function handleMistakeLimit(
	task: ITaskModel,
	delegate: ITaskModel & TaskDelegate,
	userContent: Anthropic.Messages.ContentBlockParam[],
): Promise<Anthropic.Messages.ContentBlockParam[]> {
	const consecutiveMistakeLimit = task._state.consecutiveMistakeLimit
	const consecutiveMistakeCount = task._state.consecutiveMistakeCount
	if (consecutiveMistakeLimit <= 0 || consecutiveMistakeCount < consecutiveMistakeLimit) {
		return userContent
	}

	const tskConfig = delegate.apiConfiguration
	getTelemetryService().captureConsecutiveMistakeError(task.taskId)
	getTelemetryService().captureException(
		new ConsecutiveMistakeError(
			`Task reached consecutive mistake limit (${String(consecutiveMistakeLimit)})`,
			task.taskId,
			consecutiveMistakeCount,
			consecutiveMistakeLimit,
			"consecutive_mistake_tools_used",
			tskConfig.apiProvider as string | undefined,
			getModelId(tskConfig as Parameters<typeof getModelId>[0]),
		),
	)

	const { response, text, images } = await ask(
		task.taskId,
		"mistake_limit_reached",
		t("common:errors.mistake_limit_guidance"),
	)

	if (response === "messageResponse") {
		const updatedContent = [
			...userContent,
			{ type: "text" as const, text: formatResponse.tooManyMistakes(text) },
			...formatResponse.imageBlocks(images),
		]

		await agentBroadcast(task.taskId, "api_req_feedback", text, images)
		task._state.setConsecutiveMistakeCount(0)
		return updatedContent
	}

	task._state.setConsecutiveMistakeCount(0)
	return userContent
}

export async function processUserContentWithEnv(
	task: ITaskModel,
	userContent: Anthropic.Messages.ContentBlockParam[],
	includeFileDetails: boolean,
	store: IBackendRootStore,
): Promise<{
	finalUserContent: Anthropic.Messages.ContentBlockParam[]
	slashCommandMode: string | undefined
}> {
	const showJabberwockIgnoredFiles = false
	const includeDiagnosticMessages = true
	const maxDiagnosticMessages = 50
	const currentMode = task.taskMode

	const { content: parsedUserContent, mode: slashCommandMode } = await processUserContentMentions({
		userContent,
		cwd: task.cwd,
		fileContextTracker: getFileContextTracker(),
		jabberwockIgnoreController: task.jabberwockIgnoreController,
		showJabberwockIgnoredFiles,
		includeDiagnosticMessages,
		maxDiagnosticMessages,
		skillsManager: getSkillsManager(store),
		currentMode,
	})

	if (slashCommandMode) {
		const provider = getProvider()
		const customModes = store.settings.modes.customModes
		const targetMode = getModeBySlug(slashCommandMode, customModes)
		if (targetMode) {
			await handleModeSwitch(provider, slashCommandMode)
		}
	}

	diagnosticsManager.setCurrentAction(t("diagnostics:actions.environmentDetails"))
	const envStartTime = Date.now()
	console.log(`[DEBUG: TaskLoop#${task.taskId}] Phase: Environment Details Start`)
	const environmentDetails = await getEnvironmentDetails(task, includeFileDetails)
	console.log(`[DEBUG: TaskLoop#${task.taskId}] Phase: Environment Details Complete (${Date.now() - envStartTime}ms)`)

	const contentWithoutEnvDetails = parsedUserContent.filter((block: Anthropic.Messages.ContentBlockParam) => {
		if (block.type === "text" && typeof block.text === "string") {
			const trimmed = (block.text as string).trim()
			return !(trimmed.startsWith("<environment_details>") && trimmed.endsWith("</environment_details>"))
		}
		return true
	})

	const finalUserContent = [...contentWithoutEnvDetails, { type: "text" as const, text: environmentDetails }]

	return { finalUserContent, slashCommandMode }
}
