import { types, Instance, SnapshotOut } from "mobx-state-tree"
import { IntentStatus } from "@jabberwock/types"

/**
 * Base payload type for intents on the frontend.
 *
 * Each intent type has specific payload fields — define a discriminated union
 * keyed by intent type for full type safety. This base type provides a
 * minimal common shape for the most frequent intent patterns.
 *
 * The `{ [key: string]: unknown }` fallback ensures any payload shape
 * is accepted at runtime — specific types are enforced by handler registration.
 */
export type IIntentPayload =
	| { text?: string; images?: string[]; taskConfiguration?: { [key: string]: unknown } }
	| { taskId?: string; prompt?: string }
	| { mode?: string }
	| { [key: string]: unknown }

export const IntentModel = types.model("Intent", {
	id: types.identifier,
	type: types.string,
	payload: types.frozen<IIntentPayload>(),
	status: types.enumeration("IntentStatus", [
		IntentStatus.Queued,
		IntentStatus.Processing,
		IntentStatus.Suspended,
		IntentStatus.Success,
		IntentStatus.Failed,
	]),
	priority: types.maybe(types.number),
	createdAt: types.number,
	traceId: types.maybe(types.string),
	parentId: types.maybe(types.string),
})

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Named MST model instance type
export interface IIntent extends Instance<typeof IntentModel> {}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Named MST snapshot type
export interface IntentSnapshot extends SnapshotOut<typeof IntentModel> {}

/**
 * MST store holding all intents.
 *
 * Handlers create intents by calling `createIntent()` — the IntentBus
 * reacts to newly queued intents and dispatches them to the appropriate
 * handler.
 */
export const IntentStoreModel = types
	.model("IntentStore", {
		intents: types.array(IntentModel),
	})
	.actions((self) => ({
		createIntent(intent: {
			id: string
			type: string
			payload: IIntentPayload
			status?: IntentStatus
			priority?: number
			createdAt: number
			traceId?: string
			parentId?: string
		}) {
			self.intents.push({
				...intent,
				status: intent.status ?? IntentStatus.Queued,
			})
		},

		dispatchIntent(id: string) {
			const intent = self.intents.find((i) => i.id === id)
			if (intent) intent.status = IntentStatus.Processing
		},

		suspendIntent(id: string) {
			const intent = self.intents.find((i) => i.id === id)
			if (intent) intent.status = IntentStatus.Suspended
		},

		resumeIntent(id: string) {
			const intent = self.intents.find((i) => i.id === id)
			if (intent) intent.status = IntentStatus.Processing
		},

		markSuccess(id: string) {
			const intent = self.intents.find((i) => i.id === id)
			if (intent) {
				intent.status = IntentStatus.Success
			}
		},

		failIntent(id: string) {
			const intent = self.intents.find((i) => i.id === id)
			if (intent) {
				intent.status = IntentStatus.Failed
			}
		},

		removeIntent(id: string) {
			const idx = self.intents.findIndex((i) => i.id === id)
			if (idx !== -1) {
				self.intents.splice(idx, 1)
			}
		},

		setProcessing(id: string) {
			const intent = self.intents.find((i) => i.id === id)
			if (intent) {
				intent.status = IntentStatus.Processing
			}
		},

		clearAll() {
			self.intents.clear()
		},

		runHandler<T>(fn: () => T): T {
			return fn()
		},
	}))
	.views((self) => ({
		getPendingIntents(): IIntent[] {
			return self.intents.filter((i) => i.status === IntentStatus.Queued || i.status === IntentStatus.Processing)
		},

		getByType(type: string): IIntent[] {
			return self.intents.filter((i) => i.type === type)
		},

		getById(id: string): IIntent | undefined {
			return self.intents.find((i) => i.id === id)
		},
	}))

export type IIntentStore = Instance<typeof IntentStoreModel>
export type IntentStoreSnapshot = SnapshotOut<typeof IntentStoreModel>
