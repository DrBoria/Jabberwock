export { initializeNetworkProxy, isDebugMode, isProxyEnabled } from "./main"
export {
	applyTlsVerificationOverride,
	getProxyConfig,
	restoreGlobalFetchPatch,
	restoreTlsVerificationOverride,
} from "./config"
export { configureGlobalProxy, configureUndiciProxy, patchGlobalFetch } from "./setup"
export { log, proxyState } from "./state"
export type { NetworkProxyState } from "./state"
export type { ProxyConfig } from "./types"
export { normalizeHeadersForUndici, redactProxyUrl, updateProxyEnvVars } from "./utils"
