/**
 * @file Tests for the partial-update broadcast fix in on-message-broadcast.ts.
 *
 * BUG (reasoning "stuck at The"): the "update" branch only pushed a message to
 * the webview for FINALIZED updates (`!partial`). Partial updates relied solely
 * on `sendStreamChunk()`, which only handles `say === "text"`. So partial
 * REASONING (thinking) updates mutated the store but were never pushed to the
 * webview — the thinking block froze at the first chunk ("The") until the next
 * finalized message triggered `flushStalePartials`.
 *
 * FIX: non-text partial updates now push via `sendMessageUpdated` per chunk,
 * while text partials still ride the `sendStreamChunk()` fast path.
 *
 * These tests cover exactly that branch. The real `sendMessageUpdated` runs and
 * routes through `postMessageToWebview` → the registered backend connector's
 * `sendOutbound`, which we spy on. The bus and the task store are mocked so the
 * partial paths under test do not touch `addNotification`/`saveMessages`/the
 * real MST store.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import type { Notification } from "@jabberwock/types"
import * as mst from "mobx-state-tree"
import { setProvider, setConnector, clearProvider, clearConnector } from "@features/foundation/webview/providerRegistry"

import { registerOnMessageBroadcast } from "./on-message-broadcast"
import { IntentConstants } from "@intentConstants"

const makeNotification = (over: Partial<Notification> = {}): Notification => ({
	type: "say",
	ts: 1000,
	say: "reasoning",
	text: "partial thinking…",
	partial: true,
	...over,
})

/** A mock task store matching the shape the handler reads/writes. */
const makeTaskStore = () => ({
	notifications: {
		items: [] as Notification[],
		addNotification: vi.fn(),
		updateNotification: vi.fn(),
	},
})

/** A mock context whose rootStore resolves the task by id. */
const makeContext = (task: ReturnType<typeof makeTaskStore>) => ({
	rootStore: {
		chat: {
			tasks: {
				get: (id: string) => (id === "task-1" ? task : undefined),
			},
		},
	},
})

/** A mock bus that captures the registered handler for the broadcast intent. */
const registerAndCapture = () => {
	let captured: ((intent: unknown, ctx: unknown) => unknown) | undefined
	const bus = {
		register: (type: string, handler: (intent: unknown, ctx: unknown) => unknown) => {
			if (type === IntentConstants.messages.AGENT_BROADCAST) {
				captured = handler
			}
		},
	}
	registerOnMessageBroadcast(bus as never)
	return captured!
}

describe("registerOnMessageBroadcast — partial update fix", () => {
	let sendOutbound: ReturnType<typeof vi.fn>

	beforeEach(() => {
		vi.clearAllMocks()
		// The SUT imports getSnapshot from mobx-state-tree; stub it to identity
		// so the module graph stays safe if a finalized path is ever exercised.
		vi.spyOn(mst, "getSnapshot").mockImplementation((x: unknown) => x)

		// Provide the real sendMessageUpdated's dependencies: a provider + a
		// backend connector whose sendOutbound we spy on. postMessageToWebview
		// routes through the connector when one is registered.
		sendOutbound = vi.fn().mockReturnValue(true)
		setProvider({} as never)
		setConnector({ sendOutbound } as never)
	})

	afterEach(() => {
		clearProvider()
		clearConnector()
	})

	it("pushes a partial REASONING update to the webview (the 'stuck at The' fix)", async () => {
		const handler = registerAndCapture()
		const task = makeTaskStore()
		const ctx = makeContext(task)

		const notification = makeNotification({ say: "reasoning", partial: true })
		const intent = { payload: { taskId: "task-1", notification, action: "update" } }
		await handler(intent, ctx)

		// The fix: non-text partials are pushed per chunk via sendMessageUpdated.
		expect(sendOutbound).toHaveBeenCalledTimes(1)
		expect(sendOutbound).toHaveBeenCalledWith(
			expect.objectContaining({ type: "messageUpdated", message: notification }),
		)
	})

	it("does NOT double-push a partial TEXT update (text rides sendStreamChunk)", async () => {
		const handler = registerAndCapture()
		const task = makeTaskStore()
		const ctx = makeContext(task)

		const notification = makeNotification({ say: "text", partial: true })
		const intent = { payload: { taskId: "task-1", notification, action: "update" } }
		await handler(intent, ctx)

		// Text partials must NOT be pushed here — they go through sendStreamChunk().
		expect(sendOutbound).not.toHaveBeenCalled()
	})
})
