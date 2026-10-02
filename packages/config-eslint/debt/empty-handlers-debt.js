/**
 * DEBT LEDGER — `local/no-empty-handlers`
 *
 * The rule `no-empty-handlers` is 100% GENERIC: it inspects EVERY file in the
 * checked scopes and reports (1) empty catch blocks (only a comment or nothing)
 * and (2) exported no-op functions (empty / comment-only body). It is NOT
 * scoped to any specific file or folder.
 *
 * This file is the grandfathered list of PRE-EXISTING violations, recorded so
 * the build stays green while they are migrated. Rules for this ledger:
 *
 *   - It must SHRINK over time and end EMPTY.
 *   - New files are NEVER added here — a new violation is a real bug to fix.
 *   - When a listed file is fixed (catch logs/toasts/rethrows, no-op
 *     implemented or deleted), delete its line.
 */
export const emptyHandlersDebt = [
	"backend/api/providers/openai-codex/handler/main.ts",
	"backend/api/providers/openai-codex/stream/main.ts",
	"backend/api/providers/openai-codex/utils.ts",
	"backend/api/providers/openai-native/stream/sse.ts",
	"backend/api/providers/utils/image-generation/helpers.ts",
	"backend/features/chat/task/handlers/webview-launched/api-config.ts",
	"backend/features/chat/task/messages/actions/presentAssistantMessage/helpers.ts",
	"backend/features/chat/task/messages/actions/presentAssistantMessage/validation.ts",
	"backend/features/chat/tools/actions/parseToolCall/buildersConfig.ts",
	"backend/features/chat/tools/actions/toolExecutor/toolBlock.ts",
	"backend/features/chat/tools/engine/execute/output.ts",
	"backend/features/chat/tools/mcp/delegateApprovedTasks.ts",
	"backend/features/cloud/store.ts",
	"backend/features/context/services/ContextArchiveService.ts",
	"backend/features/foundation/mst/store.ts",
	"backend/features/foundation/time-machine/actions/getCheckpointService.ts",
	"backend/features/foundation/time-machine/file-context/tracker.ts",
	"backend/features/foundation/time-machine/store.ts",
	"backend/features/foundation/webview/EventBridge.ts",
	"backend/features/foundation/window-manager/lib/messaging.ts",
	"backend/features/foundation/window-manager/lib/mode-utils.ts",
	"backend/features/foundation/window-manager/lib/window-utils.ts",
	"backend/features/hydration.ts",
	"backend/features/marketplace/store.ts",
	"backend/features/settings/agents/modes-file-service/rules/exporter.ts",
	"backend/features/settings/agents/modes-file-service/rules/utils.ts",
	"backend/features/settings/agents/store.ts",
	"backend/features/settings/auto-approval-check.ts",
	"backend/features/settings/context/sections/custom-instructions/agent-rules.ts",
	"backend/features/settings/context/sections/custom-instructions/utils.ts",
	"backend/features/settings/context/store.ts",
	"backend/features/settings/handlers/agents/handlers.ts",
	"backend/features/settings/handlers/settings-worktree/handlers.ts",
	"backend/features/settings/mcp/store.ts",
	"backend/features/settings/models/api-config-main.ts",
	"backend/features/settings/models/store.ts",
	"backend/features/settings/skills/store.ts",
	"backend/features/settings/store.ts",
	"backend/integrations/misc/images.ts",
	"backend/integrations/misc/open-file.ts",
	"backend/integrations/openai-codex/oauth/main.ts",
	"backend/integrations/terminal/ExecaTerminalProcess/helpers.ts",
	"backend/integrations/terminal/output-interceptor/cleanup.ts",
	"backend/services/checkpoints/excludes.ts",
	"backend/services/code-index/embedders/ollama/embedder.ts",
	"backend/services/code-index/embedders/openai-compatible/rate-limiter.ts",
	"backend/services/command/commands-resolve.ts",
	"backend/services/command/service.ts",
	"backend/services/glob/list-files/utils.ts",
	"backend/services/marketplace/SimpleInstaller/simple-installer.ts",
	"backend/services/marketplace/installation-meta.ts",
	"backend/services/mcp/mcp-hub/connection/manager.ts",
	"backend/services/mcp/mcp-hub/handlers.ts",
	"backend/services/mcp/mcp-hub/notifications.ts",
	"backend/services/search/file-search.ts",
	"backend/utils/ripgrep/main.ts",
	"backend/utils/text/completion-text.ts",
	"backend/utils/token/tts.ts",
	"frontend/src/features/chat/task/messages/components/say/view.tsx",
	"frontend/src/features/chat/task/messages/components/utils/visible-messages.ts",
	"frontend/src/features/cloud/utils/TelemetryClient.ts",
]
