import { IntentType } from "@jabberwock/types"
import type { IntentBus } from "@features/intents/bus"
import type { TodoItem } from "@jabberwock/types"
import { setPendingTodoList } from "@features/chat/tools"

/**
 * Handles topic.todolist.update intent — updates the pending todo list.
 * Migrated from chat/topic/handlers/on-todolist-update.ts
 */
export function registerOnTopicTodolistUpdate(bus: IntentBus): void {
	bus.register(IntentType.TopicTodolistUpdate, async (intent, _ctx) => {
		const { todos } = intent.payload as { todos?: unknown[] }
		if (Array.isArray(todos)) {
			await setPendingTodoList(todos as TodoItem[])
		}
	})
}
