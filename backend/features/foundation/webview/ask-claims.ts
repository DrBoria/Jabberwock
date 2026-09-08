/**
 * v4 §6.4 Ask claim semantics — first-response-wins.
 *
 * When an `notification.ask` is broadcast to all clients, each client's answer carries the
 * ask's `requestId`. The backend processes the FIRST `{type:"askResponse"}` for a given
 * requestId; every later response to the same requestId is a duplicate and is ignored. The
 * late responder's UI is told via `{type:"askResponseAck", requestId, status:"already-answered"}`.
 *
 * This tracker is the transport-level claim registry embodying those rules — deterministic
 * and testable with the FakeConnector, without vscode or network.
 */
import type { AskResponseValue } from "@jabberwock/types"

export type AskClaimStatus = "claimed" | "already-answered"

export interface AskClaimResult<TDecision> {
	status: AskClaimStatus
	/** The winning decision for the requestId (the first one claimed). */
	decision: TDecision | undefined
}

export class AskClaimTracker<TDecision = unknown> {
	private readonly claims = new Map<string, TDecision>()

	/**
	 * Claim the first decision for a `requestId`.
	 *
	 * Returns `{ status: "claimed", decision }` on first claim, and
	 * `{ status: "already-answered", decision: <winning> }` for any later claim of the same
	 * requestId — the caller maps the latter to an `askResponseAck` with `status:"already-answered"`.
	 */
	claim(requestId: string, decision: TDecision): AskClaimResult<TDecision> {
		const existing = this.claims.get(requestId)
		if (existing !== undefined) {
			return { status: "already-answered", decision: existing }
		}
		this.claims.set(requestId, decision)
		return { status: "claimed", decision }
	}

	has(requestId: string): boolean {
		return this.claims.has(requestId)
	}

	getDecision(requestId: string): TDecision | undefined {
		return this.claims.get(requestId)
	}
}

/**
 * D4h (§6.4): process-wide claim registry used by the askResponse handler so the standalone
 * server (and the extension) both enforce first-response-wins. Typed with the chat ask decision
 * union so the handler can broadcast the winning answer without a cast.
 */
export const askClaimTracker = new AskClaimTracker<AskResponseValue>()
