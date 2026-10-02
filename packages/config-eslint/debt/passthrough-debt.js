/**
 * GRANDFATHERED DEBT LEDGER — `local/no-passthrough`.
 *
 * The rule itself stays 100% generic (an exported function that only calls
 * another function and returns its result is a passthrough wrapper and must be
 * inlined or extracted). The files below are PRE-EXISTING violations captured
 * at the moment the rule went live. Every entry MUST be inlined / extracted and
 * then removed from this list.
 *
 * Rules:
 *   - This list must only SHRINK. New files must NEVER be added.
 *   - Target: `[]`.
 *
 * DO NOT delete this file until the list is empty.
 *
 * @type {string[]}
 */
export const passthroughDebt = [
	"backend/api/providers/bedrock/core/models.ts",
	"backend/features/chat/task/messages/actions/command/getSavedMessages.ts",
	"backend/features/chat/task/messages/actions/save/io.ts",
	"backend/features/chat/task/notifications/actions/ask/askFollowUp.ts",
	"backend/features/chat/task/notifications/actions/ask/askSubTask.ts",
	"backend/features/chat/task/notifications/actions/ask/askToolApproval.ts",
	"backend/integrations/misc/indentation-reader/helpers.ts",
	"backend/services/marketplace/SimpleInstaller/content-resolver.ts",
	"backend/shared/api/cost.ts",
]
