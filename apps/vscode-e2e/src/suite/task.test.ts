import * as assert from "assert"

import { JabberwockEventName, type Notification } from "@jabberwock/types"

import { waitUntilCompleted } from "./helpers/utils"
import { setDefaultSuiteTimeout } from "./helpers/test-utils"

suite("Jabberwock Task", function () {
	setDefaultSuiteTimeout(this)

	test("Should handle prompt and response correctly", async () => {
		const api = globalThis.api

		const messages: Notification[] = []

		api.on(JabberwockEventName.Message, ({ message }) => {
			if (message.type === "say" && message.partial === false) {
				messages.push(message)
			}
		})

		const taskId = await api.startNewTask({
			configuration: { mode: "ask", alwaysAllowModeSwitch: true, autoApprovalEnabled: true },
			text: "Hello world, what is your name? Respond with 'My name is ...'",
		})

		await waitUntilCompleted({ api, taskId })

		assert.ok(
			!!messages.find(
				({ say, text }) =>
					(say === "completion_result" || say === "text") && text?.includes("My name is Jabberwock"),
			),
			`Completion should include "My name is Jabberwock"`,
		)
	})
})
