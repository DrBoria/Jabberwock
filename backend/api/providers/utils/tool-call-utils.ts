/**
 * Shared utilities for processing tool call schemas.
 *
 * These functions ensure tool call parameter schemas conform to
 * OpenAI's strict mode requirements:
 * - `ensureAllRequired` — marks every property as required
 * - `ensureAdditionalPropertiesFalse` — sets additionalProperties: false on every object
 *
 * The canonical implementations live in `openai-codex/utils.ts`; this module
 * re-exports them so consumers can import from either location.
 */

import {
	ensureAdditionalPropertiesFalse,
	ensureAllRequired,
	shouldRecurseProp,
} from "@api/providers/openai-codex/utils"

export { ensureAdditionalPropertiesFalse, ensureAllRequired, shouldRecurseProp }
