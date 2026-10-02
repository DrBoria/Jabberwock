import type { WebSocket } from "ws"
import type { ClientTarget } from "@jabberwock/types"

export interface RegisteredClient {
	readonly clientId: string
	readonly clientKind: string
	readonly socket: WebSocket
	readonly connectedAt: number
}

/**
 * v4 single-state (§4.1): registry of connected WS clients.
 *
 * Supports multiple simultaneous clients (browser, smartwatch, APK, …). Callers can
 * deliver a frame to a single client (`ClientTarget { kind: "client" }`) or broadcast
 * to all (`ClientTarget { kind: "broadcast" }`). A client is removed from the registry
 * when its socket closes.
 *
 * Shared by the standalone web server (`connectors/web`) and the vscode extension host
 * (`connectors/vscode`) so both hosts speak exactly the same multi-client protocol.
 */
export class ClientRegistry {
	private readonly clients = new Map<string, RegisteredClient>()

	register(client: RegisteredClient): void {
		this.clients.set(client.clientId, client)
		client.socket.on("close", () => this.clients.delete(client.clientId))
	}

	unregister(clientId: string): void {
		this.clients.delete(clientId)
	}

	get(clientId: string): RegisteredClient | undefined {
		return this.clients.get(clientId)
	}

	all(): RegisteredClient[] {
		return [...this.clients.values()]
	}

	get size(): number {
		return this.clients.size
	}

	/** Resolve a `ClientTarget` to the concrete sockets that should receive a frame. */
	resolve(target: ClientTarget): WebSocket[] {
		if (target.kind === "broadcast") return this.all().map((client) => client.socket)
		const client = this.clients.get(target.clientId)
		return client ? [client.socket] : []
	}
}
