import { createTRPCUntypedClient, httpBatchLink } from "@trpc/client"
import superjson from "superjson"

import type { User, Org } from "./types.js"

export interface ClientConfig {
	url: string
	authToken: string
}

export interface RooClient {
	auth: {
		me: {
			query: () => Promise<{ type: "user"; user: User } | { type: "org"; org: Org } | null>
		}
	}
}

export const createClient = ({ url, authToken }: ClientConfig): RooClient => {
	const client = createTRPCUntypedClient({
		links: [
			httpBatchLink({
				url: `${url}/trpc`,
				transformer: superjson,
				headers: () => (authToken ? { Authorization: `Bearer ${authToken}` } : {}),
			}),
		],
	})

	return {
		auth: {
			me: {
				query: () =>
					client.query("auth.me") as Promise<{ type: "user"; user: User } | { type: "org"; org: Org } | null>,
			},
		},
	}
}
