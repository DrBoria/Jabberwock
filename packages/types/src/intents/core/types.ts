import type { Notification } from "../../messages/notification.ts"
import type { ChatMessage } from "../../messages/types.ts"

export type CoreIntents =
	| { type: "user.message.received"; payload: { taskId: string; text: string; images?: string[] } }
	| {
			type: "agent.response.received"
			payload: { taskId: string; notification: Notification; chatMessage?: ChatMessage }
	  }
	| { type: "script.finished"; payload: { taskId: string; output: string } }
	| { type: "system.failure"; payload: { taskId: string; error: string } }
	| { type: "send_message_to_agent.requested"; payload: { taskId: string; prompt: string } }
	| { type: "tool.execution.required"; payload: { taskId: string; notification: Notification } }
	| { type: "ask.response.received"; payload: { taskId: string; notification: Notification } }
	| { type: "notification.persist"; payload: { taskId: string } }
	| { type: "webview.event"; payload: { eventType: string; data: Record<string, unknown> } }
	| { type: "task.created"; payload: { taskId: string; text?: string; images?: string[] } }
	| { type: "task.cancelled"; payload: { taskId: string } }
	// ── Message Operations ──────────────────────────────────────────
	| { type: "message.delete.requested"; payload: { taskId: string; messageTs: number } }
	| { type: "message.delete.confirmed"; payload: { taskId: string; messageTs: number; restoreCheckpoint?: boolean } }
	| {
			type: "message.edit.requested"
			payload: { taskId: string; messageTs: number; text: string; images?: string[] }
	  }
	| {
			type: "message.edit.confirmed"
			payload: { taskId: string; messageTs: number; text: string; restoreCheckpoint?: boolean; images?: string[] }
	  }
	// ── Text Area Operations ─────────────────────────────────────────
	| { type: "textarea.enhance.requested"; payload: { text: string } }
	| { type: "textarea.images.select.requested"; payload: Record<string, never> }
	| { type: "textarea.files.search.requested"; payload: { query: string; requestId?: string } }
	| { type: "textarea.images.dragged"; payload: { images: string[] } }
	// ── Topic Operations ────────────────────────────────────────────
	| { type: "topic.mode.switch.requested"; payload: { mode: string } }
	| { type: "topic.commands.requested"; payload: Record<string, never> }
	| { type: "topic.todolist.update"; payload: { todos: unknown[] } }
	// ── Notification Operations ─────────────────────────────────────
	| {
			type: "notification.add"
			payload: {
				taskId: string
				notification: import("../../messages/notification.ts").Notification
				chatMessage?: ChatMessage
			}
	  }
	| {
			type: "ask.notification"
			payload: { taskId: string; notification: import("../../messages/notification.ts").Notification }
	  }
	| {
			type: "message.display"
			payload: {
				taskId: string
				notification: import("../../messages/notification.ts").Notification
				chatMessage?: ChatMessage
			}
	  }
	| { type: "log.write"; payload: { taskId: string; message: string; level: string } }
	| {
			type: "notification.checkpoint.diff.requested"
			payload: { ts: number; mode?: string; commitHash: string; previousCommitHash?: string }
	  }
	| {
			type: "notification.checkpoint.restore.requested"
			payload: { ts?: number; mode?: string; commitHash?: string }
	  }
	| { type: "notification.tts.play"; payload: { text: string } }
	| { type: "notification.tts.stop"; payload: Record<string, never> }
	| { type: "notification.tts.enabled.set"; payload: { enabled: boolean } }
	| { type: "notification.tts.speed.set"; payload: { value: number } }
	| { type: "notification.message.queue"; payload: { text: string; images?: string[] } }
	| { type: "notification.message.queue.edit"; payload: { id: string; text: string; images?: string[] } }
	| { type: "notification.message.queue.remove"; payload: { id: string } }
	| { type: "notification.elicitation.response"; payload: { values: unknown } }
	// ── Task Operations ─────────────────────────────────────────────
	| {
			type: "task.new.requested"
			payload: { text: string; images?: string[]; taskId?: string; taskConfiguration?: unknown }
	  }
	| { type: "task.cancel.requested"; payload: Record<string, never> }
	| { type: "task.clear.requested"; payload: Record<string, never> }
	| { type: "task.resume.requested"; payload: { taskId: string } }
	| { type: "task.sync.enabled.set"; payload: { enabled: boolean } }
	| { type: "task.condense.context.requested"; payload: Record<string, never> }
	| { type: "task.webview.launched"; payload: Record<string, never> }
	| { type: "task.completion.requested"; payload: { taskId: string } }
	| { type: "task.goal.add.requested"; payload: { taskId: string; text: string; importance?: number } }
	| { type: "task.goal.remove.requested"; payload: { taskId: string; id: string } }
	| {
			type: "task.goal.update.requested"
			payload: { taskId: string; id: string; text?: string; importance?: number }
	  }
	| { type: "task.goal.reorder.requested"; payload: { taskId: string; fromIndex: number; toIndex: number } }
	// ── Foundation / Window Manager ─────────────────────────────────
	| { type: "foundation.focus.panel.requested"; payload: Record<string, never> }
	| { type: "foundation.tab.switch"; payload: { tab: string; values?: Record<string, unknown>; fromMCP?: boolean } }
	| { type: "foundation.active.page.response"; payload: { requestId: string; activePage: string } }
	| { type: "foundation.state.requested"; payload: Record<string, never> }
	| { type: "foundation.task.aggregated.costs"; payload: { text: string } }
	| { type: "foundation.task.show"; payload: { text: string } }
	| { type: "foundation.task.delete"; payload: { text: string } }
	| { type: "foundation.task.export"; payload: { text: string } }
	| { type: "foundation.task.export.current"; payload: Record<string, never> }
	| { type: "foundation.task.delete.multiple"; payload: { ids: string[] } }
	// ── Context Management ──────────────────────────────────────────
	| {
			type: "context.management.required"
			payload: {
				taskId: string
				autoCondenseContext: boolean
				autoCondenseContextPercent: number
				systemPrompt: string
				environmentDetails?: string
				filesReadByJabberwock?: string[]
				cwd?: string
			}
	  }
	| { type: "context.window.exceeded"; payload: { taskId: string; error: unknown } }
	// ── Cloud ────────────────────────────────────────────────────────
	| { type: "cloud.button.clicked"; payload: Record<string, never> }
	| { type: "cloud.sign.in"; payload: { useProviderSignup?: boolean } }
	| { type: "cloud.landing.page.sign.in"; payload: { text?: string } }
	| { type: "cloud.sign.out"; payload: Record<string, never> }
	| { type: "cloud.manual.url"; payload: { text?: string } }
	| { type: "cloud.openai.codex.sign.in"; payload: Record<string, never> }
	| { type: "cloud.openai.codex.sign.out"; payload: Record<string, never> }
	| { type: "cloud.switch.organization"; payload: { organizationId?: string | null } }
	| { type: "cloud.clear.auth.skip.model"; payload: Record<string, never> }
	// ── Diagnostics ──────────────────────────────────────────────────
	| { type: "diagnostics.clear"; payload: Record<string, never> }
	// ── History ──────────────────────────────────────────────────────
	| { type: "history.commits.search"; payload: { query?: string } }
	| { type: "history.settings.import"; payload: Record<string, never> }
	| { type: "history.settings.export"; payload: Record<string, never> }
	| { type: "history.state.reset"; payload: Record<string, never> }
	| { type: "history.button.clicked"; payload: Record<string, never> }
	// ── Marketplace ──────────────────────────────────────────────────
	| { type: "marketplace.items.filter"; payload: { marketplaceManager?: unknown; filters?: Record<string, unknown> } }
	| {
			type: "marketplace.item.install"
			payload: {
				marketplaceManager?: unknown
				mpItem?: Record<string, unknown>
				mpInstallOptions?: Record<string, unknown>
			}
	  }
	| {
			type: "marketplace.item.install.with.parameters"
			payload: { marketplaceManager?: unknown; payload?: Record<string, unknown> }
	  }
	| {
			type: "marketplace.item.remove"
			payload: {
				marketplaceManager?: unknown
				mpItem?: Record<string, unknown>
				mpInstallOptions?: Record<string, unknown>
			}
	  }
	| { type: "marketplace.data.fetch"; payload: Record<string, never> }
	| { type: "marketplace.tools.refresh"; payload: Record<string, never> }
	| { type: "marketplace.install.cancel"; payload: Record<string, never> }
	| { type: "marketplace.button.clicked"; payload: Record<string, never> }
