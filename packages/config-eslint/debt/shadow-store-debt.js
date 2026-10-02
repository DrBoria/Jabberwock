/**
 * GRANDFATHERED DEBT LEDGER — `local/no-shadow-store`.
 *
 * The rule itself stays 100% generic (v2 rule #4: ALL state in MST, zero
 * module-level mutable state). The files below are PRE-EXISTING violations
 * captured at the moment the rule went live. Every entry MUST be migrated to
 * the feature's MST store and then removed from this list.
 *
 * Rules:
 *   - This list must only SHRINK. New files must NEVER be added.
 *   - Target: `[]`.
 *
 * DO NOT delete this file until the list is empty.
 *
 * @type {string[]}
 */
export const shadowStoreDebt = [
	// — chat / tools —
	"backend/features/chat/tools/engine/lifecycle/updateTodoListHelpers.ts",
	"backend/features/context/actions/registerContextIntents.ts",
	"backend/features/context/services/ContextArchiveService.ts",

	// — foundation —
	"backend/features/foundation/capabilities/backend-logger.ts",
	"backend/features/foundation/capabilities/registry.ts",
	"backend/features/foundation/host-context/context.ts",
	"backend/features/foundation/time-machine/actions/getTimeMachine.ts",
	"backend/features/foundation/webview/providerRegistry.ts",

	// — settings —
	"backend/features/settings/agents/modes-file-service/mock.ts",
	"backend/features/settings/models/provider-settings-manager/main.ts",

	// — root store holder (sanctioned shape, kept here until moved to exemptions) —
	"backend/features/store.ts",

	// — services —
	"backend/services/code-index/embedders/openai-compatible/rate-limiter.ts",
	"backend/services/mcp/core/McpServerManager.ts",
	"backend/services/tree-sitter/languageParser.ts",
	"backend/services/tree-sitter/tree-sitter/config.ts",

	// — utils —
	"backend/utils/token/countTokens.ts",
	"backend/utils/token/tiktoken.ts",
	"backend/utils/token/tts.ts",
]
