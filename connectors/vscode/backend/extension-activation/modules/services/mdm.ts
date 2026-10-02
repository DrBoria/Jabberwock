import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { z } from "zod"

import { getCloudService, hasCloudService, getClerkBaseUrl, PRODUCTION_CLERK_BASE_URL } from "@jabberwock/cloud"

import { t } from "@i18n"

// MDM Configuration Schema
const mdmConfigSchema = z.object({
	requireCloudAuth: z.boolean(),
	organizationId: z.string().optional(),
})

export type MdmConfig = z.infer<typeof mdmConfigSchema>

export type ComplianceResult = { compliant: true } | { compliant: false; reason: string }

// ── Module state ─────────────────────────────────────────────────────────
// The MDM service is a process-wide singleton. Its state (the loaded config
// and the logger) lives here as module state; the public surface is plain
// functions, not a class.
const __moduleState = {
	mdmConfig: null as MdmConfig | null,
	log: console.log as (...args: unknown[]) => void,
}

/**
 * Initialize the MDM service by loading configuration.
 * @param log Optional logger; defaults to console.log.
 */
export async function initializeMdmService(log?: (...args: unknown[]) => void): Promise<void> {
	if (log) {
		__moduleState.log = log
	}
	try {
		__moduleState.mdmConfig = await loadMdmConfig()

		if (__moduleState.mdmConfig) {
			__moduleState.log(`[MDM] Loaded MDM configuration: ${JSON.stringify(__moduleState.mdmConfig)}`)
		}
	} catch (error) {
		__moduleState.log(
			`[MDM] Error loading MDM configuration: ${error instanceof Error ? error.message : String(error)}`,
		)
		// Don't throw - extension should work without MDM config.
	}
}

/**
 * Check if cloud authentication is required by MDM policy
 */
export function requiresCloudAuth(): boolean {
	return __moduleState.mdmConfig?.requireCloudAuth ?? false
}

/**
 * Get the required organization ID from "MDM" policy
 */
export function getRequiredOrganizationId(): string | undefined {
	return __moduleState.mdmConfig?.organizationId
}

/**
 * Check if the current state is compliant with MDM policy
 */
export function isMdmCompliant(): ComplianceResult {
	// If no MDM policy, always compliant
	if (!requiresCloudAuth()) {
		return { compliant: true }
	}

	// Check if cloud service is available and has active or attempting session
	if (!hasCloudService() || !getCloudService().hasOrIsAcquiringActiveSession()) {
		return {
			compliant: false,
			reason: t("mdm.errors.cloud_auth_required"),
		}
	}

	// Check organization match if specified
	const requiredOrgId = getRequiredOrganizationId()
	if (requiredOrgId) {
		try {
			// First try to get from "active" session
			let currentOrgId = getCloudService().getOrganizationId()

			// If no active session, check stored credentials
			if (!currentOrgId) {
				const storedOrgId = getCloudService().getStoredOrganizationId()

				// null means personal account, which is not compliant for org requirements
				if (storedOrgId === null || storedOrgId !== requiredOrgId) {
					return {
						compliant: false,
						reason: t("mdm.errors.organization_mismatch"),
					}
				}

				currentOrgId = storedOrgId
			}

			if (currentOrgId !== requiredOrgId) {
				return {
					compliant: false,
					reason: t("mdm.errors.organization_mismatch"),
				}
			}
		} catch (error) {
			__moduleState.log("[MDM] Error checking organization ID:", error)
			return {
				compliant: false,
				reason: t("mdm.errors.verification_failed"),
			}
		}
	}

	return { compliant: true }
}

/**
 * Load MDM configuration from "system" location
 */
async function loadMdmConfig(): Promise<MdmConfig | null> {
	const configPath = getMdmConfigPath()

	try {
		// Check if file exists
		if (!fs.existsSync(configPath)) {
			return null
		}

		// Read and parse the configuration file
		const configContent = fs.readFileSync(configPath, "utf-8")
		const parsedConfig = JSON.parse(configContent)

		// Validate against schema
		return mdmConfigSchema.parse(parsedConfig)
	} catch (error) {
		__moduleState.log(`[MDM] Error reading MDM config from ${configPath}:`, error)
		return null
	}
}

/**
 * Get the platform-specific MDM configuration file path
 */
function getMdmConfigPath(): string {
	const platform = os.platform()
	const isProduction = getClerkBaseUrl() === PRODUCTION_CLERK_BASE_URL
	const configFileName = isProduction ? "mdm.json" : "mdm.dev.json"

	switch (platform) {
		case "win32": {
			// Windows: %ProgramData%\Jabberwock\mdm.json or mdm.dev.json
			const programData = process.env.PROGRAMDATA || "C:\\ProgramData"
			return path.join(programData, "Jabberwock", configFileName)
		}

		case "darwin":
			// macOS: /Library/Application Support/Jabberwock/mdm.json or mdm.dev.json
			return `/Library/Application Support/Jabberwock/${configFileName}`

		case "linux":
		default:
			// Linux: /etc/jabberwock/mdm.json or mdm.dev.json
			return `/etc/jabberwock/${configFileName}`
	}
}
