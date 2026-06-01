/**
 * Fix remaining production type errors after Task.ts getter/setter refactoring.
 *
 * Fixes:
 * 1. Task.ts - TaskStatus enum values (string literals → enum)
 * 2. requestAbortManager.ts - MST cast (as Record → as unknown as Record)
 * 3. streamChunkHandlers.ts - MST streamingToolCallIndices helper + .get()/.delete() fixes
 * 4. DiffViewProvider.ts - task.say → say(task, ...)
 * 5. All tool files - task.sayAndCreateMissingParamError → sayAndCreateMissingParamError(task, ...)
 * 6. handlers.ts - addClineToStack cast to CurrentTask
 */

import fs from "fs"
import path from "path"

const root = process.cwd()

function fixTaskStatusEnum() {
	const filePath = path.join(root, "src/features/chat/task/Task.ts")
	let content = fs.readFileSync(filePath, "utf-8")

	content = content.replace(
		`return this._state.idleAsk ? "idle" : this._state.resumableAsk ? "resumable" : this._state.interactiveAsk ? "interactive" : "active"`,
		`return this._state.idleAsk ? TaskStatus.Idle : this._state.resumableAsk ? TaskStatus.Resumable : this._state.interactiveAsk ? TaskStatus.Interactive : TaskStatus.Active`,
	)

	fs.writeFileSync(filePath, content)
	console.log("[FIX 1/6] Task.ts - TaskStatus enum values")
}

function fixRequestAbortManagerCast() {
	const filePath = path.join(root, "src/features/chat/task/utils/requestAbortManager.ts")
	let content = fs.readFileSync(filePath, "utf-8")

	content = content.replace(
		`as Record<string, number>)[key]`,
		`as unknown as Record<string, number>)[key]`,
	)

	fs.writeFileSync(filePath, content)
	console.log("[FIX 2/6] requestAbortManager.ts - MST cast (as unknown as Record)")
}

function fixStreamChunkHandlers() {
	const filePath = path.join(root, "src/features/chat/task/utils/streamChunkHandlers.ts")
	let content = fs.readFileSync(filePath, "utf-8")

	// Add helper function after the `import { say } from "./messaging"` line
	content = content.replace(
		`import { say } from "./messaging"`,
		`import { say } from "./messaging"

/**
 * Casts the MST streamingToolCallIndices to a plain Record for safe index access.
 * MST model types don't have index signatures, so we need this cast for
 * reads, writes, and deletes.
 */
function getStreamingToolCallIndices(task: Task): Record<string, number> {
	return task._state.streamingToolCallIndices as unknown as Record<string, number>
}`,
	)

	// Replace all 4 variable declarations of `const streamingToolCallIndices = task._state.streamingToolCallIndices`
	// with `const streamingToolCallIndices = getStreamingToolCallIndices(task)`

	// Scope 1 (lines 119-120): inside tool_call_start
	content = content.replace(
		`const streamingToolCallIndices = task._state.streamingToolCallIndices
				if (event.id in streamingToolCallIndices)`,
		`const streamingToolCallIndices = getStreamingToolCallIndices(task)
				if (event.id in streamingToolCallIndices)`,
	)

	// Scope 2 (lines 161-162): inside tool_call_delta
	content = content.replace(
		`const streamingToolCallIndices = task._state.streamingToolCallIndices
						const toolUseIndex = streamingToolCallIndices[event.id]`,
		`const streamingToolCallIndices = getStreamingToolCallIndices(task)
						const toolUseIndex = streamingToolCallIndices[event.id]`,
	)

	// Scope 3 (lines 180-181): inside tool_call_end
	content = content.replace(
		`const streamingToolCallIndices = task._state.streamingToolCallIndices
					const toolUseIndex = streamingToolCallIndices.get(event.id)`,
		`const streamingToolCallIndices = getStreamingToolCallIndices(task)
					const toolUseIndex = streamingToolCallIndices[event.id]`,
	)

	// Line 214: streamingToolCallIndices.delete(event.id) → delete streamingToolCallIndices[event.id]
	content = content.replace(
		`streamingToolCallIndices.delete(event.id)`,
		`delete streamingToolCallIndices[event.id]`,
	)

	fs.writeFileSync(filePath, content)
	console.log("[FIX 3/6] streamChunkHandlers.ts - MST helper + .get()/.delete() fixes")
}

function fixDiffViewProviderSay() {
	const filePath = path.join(root, "src/integrations/editor/DiffViewProvider.ts")
	let content = fs.readFileSync(filePath, "utf-8")

	// Add import of say if not present
	if (!content.includes('import { say } from')) {
		content = content.replace(
			`import { Task } from "../../features/chat/task/Task"`,
			`import { Task } from "../../features/chat/task/Task"
import { say } from "../../features/chat/task/utils/messaging"`,
		)
	}

	// Replace task.say("user_feedback_diff", ...) with say(task, "user_feedback_diff", ...)
	content = content.replace(
		`await task.say("user_feedback_diff"`,
		`await say(task, "user_feedback_diff"`,
	)

	fs.writeFileSync(filePath, content)
	console.log("[FIX 4/6] DiffViewProvider.ts - task.say → say(task, ...)")
}

function fixToolSayAndCreateMissingParamError() {
	const toolsDir = path.join(root, "src/core/tools")
	const files = fs.readdirSync(toolsDir, { recursive: true }).filter(
		(f) => f.endsWith(".ts") && !f.includes("__tests__"),
	)

	for (const file of files) {
		const filePath = path.join(toolsDir, file)
		let content = fs.readFileSync(filePath, "utf-8")

		if (!content.includes("task.sayAndCreateMissingParamError(")) {
			continue
		}

		// Check if sayAndCreateMissingParamError is already imported from messaging
		const messagingImportRegex = /import\s*\{([^}]*)\}\s*from\s*["'].*\/messaging["']/
		const match = content.match(messagingImportRegex)

		if (match) {
			const importStatement = match[0]
			const importGroup = match[1]
			if (!importGroup.includes("sayAndCreateMissingParamError")) {
				// Add sayAndCreateMissingParamError to existing import
				content = content.replace(
					messagingImportRegex,
					importStatement.replace(importGroup, importGroup.trim() + ", sayAndCreateMissingParamError"),
				)
			}
		} else {
			// Need to add a new import from messaging
			// Find a good place - after another import from features/chat/task
			const taskImportRegex = /import\s*\{[^}]*\}\s*from\s*["'].*features\/chat\/task[^'"]*["']/
			const taskMatch = content.match(taskImportRegex)
			if (taskMatch) {
				content = content.replace(
					taskImportRegex,
					(match) =>
						`${match}\nimport { sayAndCreateMissingParamError } from "../../features/chat/task/utils/messaging"`,
				)
			}
		}

		// Replace task.sayAndCreateMissingParamError(...) with sayAndCreateMissingParamError(task, ...)
		content = content.replace(
			/await\s+task\.sayAndCreateMissingParamError\(/g,
			"await sayAndCreateMissingParamError(task, ",
		)

		fs.writeFileSync(filePath, content)
		console.log(`  [FIX 5/6] ${file} - sayAndCreateMissingParamError`)
	}

	console.log("[FIX 5/6] All tool files - sayAndCreateMissingParamError")
}

function fixHandlersAddClineToStack() {
	const filePath = path.join(root, "src/features/foundation/window-manager/handlers.ts")
	let content = fs.readFileSync(filePath, "utf-8")

	// Add CurrentTask to import
	content = content.replace(
		`import type { EventBridge } from "../../../core/webview/EventBridge"`,
		`import type { CurrentTask, EventBridge } from "../../../core/webview/EventBridge"`,
	)

	// Replace addClineToStack(newTask) with addClineToStack(newTask as unknown as CurrentTask)
	content = content.replace(
		`await provider.addClineToStack(newTask)`,
		`await provider.addClineToStack(newTask as unknown as CurrentTask)`,
	)

	fs.writeFileSync(filePath, content)
	console.log("[FIX 6/6] handlers.ts - addClineToStack cast to CurrentTask")
}

// Run all fixes
console.log("=== Fixing remaining production type errors ===\n")

fixTaskStatusEnum()
fixRequestAbortManagerCast()
fixStreamChunkHandlers()
fixDiffViewProviderSay()
fixToolSayAndCreateMissingParamError()
fixHandlersAddClineToStack()

console.log("\n=== All fixes applied ===")
