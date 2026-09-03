import * as path from "path"
import * as fs from "fs/promises"

import { z } from "zod"

import type { IExtensionContextView } from "@features/foundation/host-context/context"
import { fileExistsAtPath } from "@utils/io/fs"
import { safeWriteJson } from "@utils/io"
import { getSettingsDirectoryPath } from "@utils/io"
import { ensureSettingsDirectoryExists } from "@utils/globalContext"
import { GlobalFileNames } from "@shared/globalFileNames"

import { ServerConfigSchema } from "./schemas"
import { validateServerConfig } from "./validation"

// ─── Config file helpers ─────────────────────────────────────────────

export async function resolveConfigPath(
	source: "global" | "project",
	getMcpSettingsFilePath: () => Promise<string>,
	getProjectMcpPath: () => Promise<string | null>,
): Promise<string> {
	if (source === "project") {
		const projectMcpPath = await getProjectMcpPath()
		if (!projectMcpPath) {
			throw new Error("Project MCP configuration file not found")
		}
		return projectMcpPath
	}
	return await getMcpSettingsFilePath()
}

export async function readServerConfigData(
	actualSource: string,
	getMcpSettingsFilePath: () => Promise<string>,
	getProjectMcpPath: () => Promise<string | null>,
): Promise<Record<string, unknown>> {
	if (actualSource === "project") {
		const projectMcpPath = await getProjectMcpPath()
		if (projectMcpPath) {
			const content = await fs.readFile(projectMcpPath, "utf-8")
			return JSON.parse(content)
		}
		return {}
	}
	const configPath = await getMcpSettingsFilePath()
	const content = await fs.readFile(configPath, "utf-8")
	return JSON.parse(content)
}

export async function readServerToolConfig(
	serverName: string,
	actualSource: string,
	getMcpSettingsFilePath: () => Promise<string>,
	getProjectMcpPath: () => Promise<string | null>,
): Promise<{ alwaysAllowConfig: string[]; disabledToolsList: string[] }> {
	let alwaysAllowConfig: string[] = []
	let disabledToolsList: string[] = []
	try {
		const serverConfigData = await readServerConfigData(actualSource, getMcpSettingsFilePath, getProjectMcpPath)
		if (serverConfigData) {
			const mcpServersData = serverConfigData["mcpServers"] as
				| Record<string, { alwaysAllow?: string[]; disabledTools?: string[] }>
				| undefined
			alwaysAllowConfig = mcpServersData?.[serverName]?.alwaysAllow ?? []
			disabledToolsList = mcpServersData?.[serverName]?.disabledTools ?? []
		}
	} catch (error) {
		console.error(`[jabberwock] Failed to read tool configuration for ${serverName}:`, error)
	}
	return { alwaysAllowConfig, disabledToolsList }
}

export async function readServerConfigFromFile(
	serverName: string,
	source: "global" | "project",
	getMcpSettingsFilePath: () => Promise<string>,
	getProjectMcpPath: () => Promise<string | null>,
): Promise<z.infer<typeof ServerConfigSchema>> {
	let configPath: string
	if (source === "project") {
		const projectMcpPath = await getProjectMcpPath()
		if (!projectMcpPath) {
			throw new Error("Project MCP configuration file not found")
		}
		configPath = projectMcpPath
	} else {
		configPath = await getMcpSettingsFilePath()
	}

	try {
		await fs.access(configPath)
	} catch (error) {
		console.error("[jabberwock] Settings file not accessible:", error)
		throw new Error("Settings file not accessible")
	}

	const content = await fs.readFile(configPath, "utf-8")
	const config = JSON.parse(content)

	if (!config || typeof config !== "object") {
		throw new Error("Invalid config structure")
	}

	if (!config.mcpServers || typeof config.mcpServers !== "object") {
		throw new Error("No mcpServers section in config")
	}

	if (!config.mcpServers[serverName]) {
		throw new Error(`Server ${serverName} not found in config`)
	}

	return validateServerConfig(config.mcpServers[serverName], serverName)
}

export async function updateServerConfig(
	serverName: string,
	configUpdate: Record<string, unknown>,
	source: "global" | "project",
	resolveConfigPath: () => Promise<string>,
	setProgrammaticUpdateFlag: () => void,
	resetProgrammaticUpdateFlag: () => void,
): Promise<void> {
	const configPath = await resolveConfigPath()

	const content = await fs.readFile(configPath, "utf-8")
	const config = JSON.parse(content)

	const hasValidConfig = config && typeof config === "object"
	if (!hasValidConfig) {
		throw new Error("Invalid config structure")
	}

	const hasMcpServers = config.mcpServers && typeof config.mcpServers === "object"
	if (!hasMcpServers) {
		config.mcpServers = {}
	}

	if (!config.mcpServers[serverName]) {
		config.mcpServers[serverName] = {}
	}

	const serverConfig = {
		...config.mcpServers[serverName],
		...configUpdate,
	}

	if (!serverConfig.alwaysAllow) {
		serverConfig.alwaysAllow = []
	}

	config.mcpServers[serverName] = serverConfig

	const updatedConfig = {
		mcpServers: config.mcpServers,
	}

	setProgrammaticUpdateFlag()
	try {
		await safeWriteJson(configPath, updatedConfig, { prettyPrint: true })
	} finally {
		resetProgrammaticUpdateFlag()
	}
}

// v4 B2 (L14): widened to the structural context view — only globalStorageUri is consumed via ensureSettingsDirectoryExists.
export async function getMcpSettingsFilePath(context: IExtensionContextView): Promise<string> {
	const mcpSettingsFilePath = path.join(await ensureSettingsDirectoryExists(context), GlobalFileNames.mcpSettings)
	const fileExists = await fileExistsAtPath(mcpSettingsFilePath)
	if (!fileExists) {
		await fs.writeFile(
			mcpSettingsFilePath,
			`{
	 "mcpServers": {

	 }
}`,
		)
	}
	return mcpSettingsFilePath
}

export async function getMcpServersPath(contextStorageUri: string): Promise<string> {
	const settingsPath = await getSettingsDirectoryPath(contextStorageUri)
	const mcpServersPath = path.join(settingsPath, "mcpServers")
	await fs.mkdir(mcpServersPath, { recursive: true })
	return mcpServersPath
}
