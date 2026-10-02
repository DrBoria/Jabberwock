// Pure re-export barrel - house rule local/no-logic-in-index allows only imports and re-exports in index files [D-actions-barrel-split]. Intent registration and the handler/dedup registry live in ./context-actions; the chunked delivery loop lives in ./history-delivery (both within their line budgets).

export { registerContextIntents } from "./registerContextIntents"
export { runHistoryRangeDelivery } from "./runHistoryDelivery"
export type { HistoryRangeDeliveryOptions, HistoryRangeRunResult } from "./runHistoryDelivery"
