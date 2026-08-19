import type { CloudUserInfo } from "../../cloud/organization.ts"
import type { ShareVisibility } from "../../cloud/index.ts"
import type { DiagnosticSnapshot } from "../../utils/diagnostics.ts"

export interface CloudBackendToWebview {
	authenticatedUser: { userInfo?: CloudUserInfo }
	organizationSwitchResult: { organizationId?: string | null }
	shareTaskSuccess: { visibility?: ShareVisibility }
	rooCreditBalance: { value?: number }
}

export interface CloudWebviewToBackend {
	cloudButtonClicked: object
	jabberwockCloudSignIn: { useProviderSignup?: boolean }
	cloudLandingPageSignIn: object
	jabberwockCloudSignOut: object
	jabberwockCloudManualUrl: { url?: string }
	openAiCodexSignIn: object
	openAiCodexSignOut: object
	switchOrganization: { organizationId?: string | null }
	clearCloudAuthSkipModel: object
}

export interface DiagnosticsBackendToWebview {
	diagnostics: { diagnostics?: DiagnosticSnapshot }
}

export interface DiagnosticsWebviewToBackend {
	clearDiagnostics: object
	downloadErrorDiagnostics: object
}
