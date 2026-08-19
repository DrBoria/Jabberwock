import { types, Instance } from "mobx-state-tree"

import { getApiMetrics } from "@shared/api/getApiMetrics"

import type { AutoApprovalResult } from "@features/settings/store.types"
import type { GlobalState, Notification, NotificationAsk, AskResponseValue } from "@jabberwock/types"

/**
 * Tracks consecutive auto-approved requests and cost limits per-task.
 * Used via task.autoApprovalHandler in the task store.
 *
 * Replaces the class-based AutoApprovalHandler with a proper MST model,
 * eliminating class mutable state (Criterion #15).
 */
export const AutoApprovalHandlerModel = types
	.model("AutoApprovalHandler", {
		lastResetMessageIndex: types.optional(types.number, 0),
		consecutiveAutoApprovedRequestsCount: types.optional(types.number, 0),
		consecutiveAutoApprovedCost: types.optional(types.number, 0),
	})
	.actions((self) => ({
		/**
		 * Check if auto-approval limits have been reached and handle user approval if needed.
		 * Inlines request-limit and cost-limit checks as local helpers.
		 */
		async checkAutoApprovalLimits(
			state: GlobalState | undefined,
			messages: Notification[],
			askForApproval: (
				type: NotificationAsk,
				data: string,
			) => Promise<{ response: AskResponseValue; text?: string; images?: string[] }>,
		): Promise<AutoApprovalResult> {
			// ── Check request limit ──
			const maxRequests = state?.allowedMaxRequests || Infinity
			const messagesAfterReset = messages.slice(self.lastResetMessageIndex)
			self.consecutiveAutoApprovedRequestsCount =
				messagesAfterReset.filter((msg) => msg.type === "say" && msg.say === "api_req_started").length + 1

			if (self.consecutiveAutoApprovedRequestsCount > maxRequests) {
				const { response } = await askForApproval(
					"auto_approval_max_req_reached",
					JSON.stringify({ count: maxRequests, type: "requests" }),
				)

				if (response === "yesButtonClicked") {
					self.lastResetMessageIndex = messages.length
					return {
						shouldProceed: true,
						requiresApproval: true,
						approvalType: "requests",
						approvalCount: maxRequests,
					}
				}

				return {
					shouldProceed: false,
					requiresApproval: true,
					approvalType: "requests",
					approvalCount: maxRequests,
				}
			}

			// ── Check cost limit ──
			const maxCost = state?.allowedMaxCost || Infinity
			const messagesAfterResetForCost = messages.slice(self.lastResetMessageIndex)
			self.consecutiveAutoApprovedCost = getApiMetrics(messagesAfterResetForCost).totalCost

			const EPSILON = 0.0001
			if (self.consecutiveAutoApprovedCost > maxCost + EPSILON) {
				const { response } = await askForApproval(
					"auto_approval_max_req_reached",
					JSON.stringify({ count: maxCost.toFixed(2), type: "cost" }),
				)

				if (response === "yesButtonClicked") {
					self.lastResetMessageIndex = messages.length
					return {
						shouldProceed: true,
						requiresApproval: true,
						approvalType: "cost",
						approvalCount: maxCost.toFixed(2),
					}
				}

				return {
					shouldProceed: false,
					requiresApproval: true,
					approvalType: "cost",
					approvalCount: maxCost.toFixed(2),
				}
			}

			return { shouldProceed: true, requiresApproval: false }
		},

		/**
		 * Reset the tracking (typically called when starting a new task)
		 */
		resetRequestCount(): void {
			self.lastResetMessageIndex = 0
			self.consecutiveAutoApprovedRequestsCount = 0
			self.consecutiveAutoApprovedCost = 0
		},

		/**
		 * Get current approval state for debugging/testing
		 */
		getApprovalState(): { requestCount: number; currentCost: number } {
			return {
				requestCount: self.consecutiveAutoApprovedRequestsCount,
				currentCost: self.consecutiveAutoApprovedCost,
			}
		},
	}))

export type IAutoApprovalHandler = Instance<typeof AutoApprovalHandlerModel>
