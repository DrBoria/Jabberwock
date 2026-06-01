/**
 * Notifications action barrel — domain-specific ask action creators.
 *
 * These replace the monolithic `ask()` function with typed action creators
 * that emit the appropriate intent type for each ask domain:
 *
 * - `askToolApproval` — Tool/capability approval requests (dialog)
 * - `askFollowUp` — Follow-up questions (dialog)
 * - `askSubTask` — Sub-task completion approval (dialog)
 *
 * Each creates an Intent which is handled by the corresponding notification
 * handler to add the notification to the MST store.
 */
export { askToolApproval } from "./askToolApproval"
export { askFollowUp } from "./askFollowUp"
export { askSubTask } from "./askSubTask"
