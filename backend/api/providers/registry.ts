import type { ApiHandler } from "@api/index"

type ProviderConstructor = new (options: Record<string, unknown>) => ApiHandler
type ProviderFactory = (options: Record<string, unknown>) => ApiHandler
type ProviderEntry = ProviderConstructor | ProviderFactory

const __moduleState = {
	providerRegistry: new Map<string, ProviderEntry>(),
}
/** Register a host-specific provider (called by the connector at activation). */
export function registerProvider(name: string, entry: ProviderEntry): void {
	__moduleState.providerRegistry.set(name, entry)
}

/** Look up a registered provider (returns undefined if not registered). */
export function getProvider(name: string): ProviderEntry | undefined {
	const entry = __moduleState.providerRegistry.get(name)
	return entry
}

/** Check if a provider is registered. */
export function hasProvider(name: string): boolean {
	const present = __moduleState.providerRegistry.has(name)
	return present
}
