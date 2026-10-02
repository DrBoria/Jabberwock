export { AuthSessionManager, type AuthSessionManagerDeps } from "./session-manager.ts"
export { clerkSignIn, clerkCreateSessionToken, clerkMe, clerkLogout } from "./clerk-api/main.ts"
export {
	type ClerkApiDependencies,
	buildUserInfoFromClerkData,
	enrichWithOrganizationInfo,
	clerkGetOrganizationMemberships,
} from "./clerk-api/enrichment.ts"
export { StaticTokenAuthService } from "./StaticTokenAuthService.ts"
export { WebAuthService } from "./web-auth/main.ts"
export {
	buildLoginUrl,
	buildLoginErrorContext,
	storeCredentials,
	loadCredentials,
	clearCredentials,
	initiateLogin,
	handleAuthCallback,
	performLogout,
} from "./web-auth/helpers.ts"
export {
	authCredentialsSchema,
	type AuthCredentials,
	clerkSignInResponseSchema,
	clerkCreateSessionTokenResponseSchema,
	clerkMeResponseSchema,
	clerkOrganizationMembershipsSchema,
} from "./web-auth/schemas.ts"
