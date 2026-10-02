/**
 * DEBT LEDGER — `local/no-impure-utils`
 *
 * The rule `no-impure-utils` is 100% GENERIC: it inspects EVERY `*-utils.ts` /
 * `utils.ts` file in the checked scopes and reports async/awaiting exports,
 * store/host-environment access, and handler-named exports. It is NOT scoped to
 * any specific file or folder.
 *
 * This file is the grandfathered list of PRE-EXISTING violations, recorded so
 * the build stays green while they are migrated. Rules for this ledger:
 *
 *   - It must SHRINK over time and end EMPTY.
 *   - New files are NEVER added here — a new violation is a real bug to fix.
 *   - When a listed file is fixed, delete its line.
 *
 * Migration target for each entry: rename the file to its real concern
 * (…/handlers/…, …/actions/…) and split the pure helpers out into a genuine
 * `*-utils.ts`.
 */
export const impureUtilsDebt = [
	"backend/api/providers/jabberwock/utils.ts",
	"backend/api/providers/minimax/utils.ts",
	"backend/api/providers/native-ollama/utils.ts",
	"backend/api/providers/openai-codex/utils.ts",
	"backend/features/api/handlers/stream/streamExecutor/utils.ts",
	"backend/features/chat/tools/engine/write/writeToFileHelpers/utils.ts",
	"backend/features/foundation/window-manager/lib/mode-utils.ts",
	"backend/features/foundation/window-manager/lib/window-utils.ts",
	"backend/features/settings/agents/modes-file-service/rules/utils.ts",
	"backend/features/settings/context/sections/custom-instructions/utils.ts",
	"backend/services/code-index/embedders/openai-compatible/utils.ts",
	"backend/services/code-index/embedders/openrouter/utils.ts",
	"backend/services/code-index/processors/scannerProcessing/scanner-file-utils.ts",
	"backend/services/glob/list-files/utils.ts",
	"backend/services/marketplace/SimpleInstaller/path-utils.ts",
	"backend/services/marketplace/org-utils.ts",
	"backend/services/mcp/mcp-hub/connection/server-connection-utils.ts",
	"frontend/src/app-shell/message-utils.ts",
	"frontend/src/features/chat/ask/utils.ts",
	"frontend/src/features/chat/task/components/task-header/utils.ts",
	"frontend/src/features/chat/task/messages/components/chat-area/utils.ts",
	"frontend/src/features/chat/task/messages/components/command/execution-utils.ts",
	"frontend/src/features/foundation/components/mermaid/utils.ts",
]
