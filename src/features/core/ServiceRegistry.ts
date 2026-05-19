import type { CloudService } from "@jabberwock/cloud"
import type { AuthState, CloudUserInfo } from "@jabberwock/types"
import type { CustomModesManager } from "../../core/config/CustomModesManager"
import type { ProviderSettingsManager } from "../../core/config/ProviderSettingsManager"
import type { OutputInterceptor } from "../../integrations/terminal/OutputInterceptor"
import type { MdmService } from "../../services/mdm/MdmService"
import type { McpServerManager } from "../../services/mcp/McpServerManager"

/**
 * ServiceRegistry holds references to non-serializable class instances
 * (services, managers, etc.) that cannot be stored in MST but must be
 * accessible throughout the application.
 *
 * This replaces all module-level mutable variables and static singleton
 * patterns. The registry lives alongside the MST BackendRootStore and
 * is accessed via getServiceRegistry().
 */
export interface ServiceRegistry {
	cloudService?: CloudService
	customModesManager?: CustomModesManager
	providerSettingsManager?: ProviderSettingsManager
	interceptor?: OutputInterceptor
	mdmService?: MdmService
	mcpManager?: McpServerManager
	authStateChangedHandler?: (data: { state: AuthState; previousState: AuthState }) => Promise<void>
	settingsUpdatedHandler?: () => void
	userInfoHandler?: (data: { userInfo: CloudUserInfo }) => Promise<void>
}

let _serviceRegistry: ServiceRegistry = {}

export function getServiceRegistry(): ServiceRegistry {
	return _serviceRegistry
}

export function setServiceRegistry(registry: Partial<ServiceRegistry>): void {
	_serviceRegistry = { ..._serviceRegistry, ...registry }
}

export function resetServiceRegistry(): void {
	_serviceRegistry = {}
}
