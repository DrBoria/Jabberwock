import { getJabberwockApiUrl } from "../config.ts"

interface BackfillOptions {
	authService: { isAuthenticated: () => boolean; getSessionToken: () => string | undefined }
	settingsService: { isTaskSyncEnabled: () => boolean }
	getEventProperties: (event: {
		event: string
		properties: Record<string, unknown>
	}) => Promise<Record<string, unknown>>
	debug?: boolean
}

export async function backfillMessages(
	messages: { text: string; ts: number }[],
	taskId: string,
	options: BackfillOptions,
): Promise<void> {
	if (!options.authService.isAuthenticated()) {
		if (options.debug) {
			console.info(`[TelemetryClient#backfillMessages] Skipping: Not authenticated`)
		}
		return
	}

	const token = options.authService.getSessionToken()

	if (!token) {
		console.error(`[TelemetryClient#backfillMessages] Unauthorized: No session token available.`)
		return
	}

	try {
		const mergedProperties = await options.getEventProperties({
			event: "task:message",
			properties: { taskId },
		})

		const formData = new FormData()
		formData.append("taskId", taskId)
		formData.append("properties", JSON.stringify(mergedProperties))

		formData.append(
			"file",
			new File([JSON.stringify(messages)], "task.json", {
				type: "application/json",
			}),
		)

		if (options.debug) {
			console.info(`[TelemetryClient#backfillMessages] Uploading ${messages.length} messages for task ${taskId}`)
		}

		const url = `${getJabberwockApiUrl()}/api/events/backfill`
		const fetchOptions: RequestInit = {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
			},
			body: formData,
		}

		try {
			const response = await fetch(url, fetchOptions)

			if (!response.ok) {
				console.error(
					`[TelemetryClient#backfillMessages] POST events/backfill -> ${response.status} ${response.statusText}`,
				)
			}
		} catch (fetchError) {
			console.error(`[TelemetryClient#backfillMessages] Network error: ${fetchError}`)
			throw fetchError
		}
	} catch (error) {
		console.error(`[TelemetryClient#backfillMessages] Error uploading messages: ${error}`)
	}
}
