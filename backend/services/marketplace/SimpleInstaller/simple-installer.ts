import * as fs from "fs/promises"
import * as path from "path"

// v4 B2 (L3/L14): structural host-context view instead of the vscode ExtensionContext type.
import type { IExtensionContextView } from "@features/foundation/host-context/context"
import * as yaml from "yaml"

import type { MarketplaceItem, InstallMarketplaceItemOptions } from "@jabberwock/types"
import { importModeWithRules, deleteCustomModeFromFile } from "@features/settings/agents"

import {
	resolveContent,
	resolveMethodParameters,
	mergeParameters,
	applyParameterReplacements,
	resolveSelectedIndexOverride,
	readMcpFile,
	findServerLine,
} from "./content-resolver"
import { getModeFilePath, getMcpFilePath } from "./path-utils"

export interface InstallOptions extends InstallMarketplaceItemOptions {
	target: "project" | "global"
	selectedIndex?: number
}

export class SimpleInstaller {
	constructor(private readonly context: IExtensionContextView) {}

	async installItem(item: MarketplaceItem, options: InstallOptions): Promise<{ filePath: string; line?: number }> {
		const { target } = options

		switch (item.type) {
			case "mode":
				return await this.installMode(item, target)
			case "mcp":
				return await this.installMcp(item, target, options)
			default:
				throw new Error(`Unsupported item type: ${(item as { type: string }).type}`)
		}
	}

	private async installMode(
		item: MarketplaceItem,
		target: "project" | "global",
	): Promise<{ filePath: string; line?: number }> {
		if (!item.content) {
			throw new Error("Mode item missing content")
		}

		if (Array.isArray(item.content)) {
			throw new Error("Mode content should not be an array")
		}

		const importData = {
			customModes: [yaml.parse(item.content)],
		}
		const importYaml = yaml.stringify(importData)

		const result = await importModeWithRules(importYaml, target)

		if (!result.success) {
			throw new Error(result.error || "Failed to import mode")
		}

		const filePath = await getModeFilePath(target, this.context)

		let line: number | undefined
		try {
			const fileContent = await fs.readFile(filePath, "utf-8")
			const lines = fileContent.split("\n")
			const modeData = yaml.parse(item.content)

			if (modeData?.slug) {
				const slugLineIndex = lines.findIndex(
					(l) => l.includes(`slug: ${modeData.slug}`) || l.includes(`slug: "${modeData.slug}"`),
				)
				if (slugLineIndex >= 0) {
					line = slugLineIndex + 1
				}
			}
		} catch (_error) {
			// If we can't find the line number, that's okay
		}

		return { filePath, line }
	}

	private async installMcp(
		item: MarketplaceItem,
		target: "project" | "global",
		options?: InstallOptions,
	): Promise<{ filePath: string; line?: number }> {
		if (!item.content) {
			throw new Error("MCP item missing content")
		}

		let contentToUse = resolveContent(item, options?.selectedIndex)
		let methodParameters = resolveMethodParameters(item, options?.selectedIndex)
		const allParameters = mergeParameters(item, methodParameters)

		if (options?.parameters && allParameters.length > 0) {
			const stringParams = Object.fromEntries(
				Object.entries(options.parameters).map(([key, value]) => [key, String(value)]),
			)
			contentToUse = applyParameterReplacements(contentToUse, stringParams, allParameters)
		}

		contentToUse = resolveSelectedIndexOverride(item, contentToUse, methodParameters, options?.parameters)

		const filePath = await getMcpFilePath(target, this.context)
		const mcpData = JSON.parse(contentToUse)

		const existingData = await readMcpFile(filePath)
		existingData.mcpServers = existingData.mcpServers ?? {}

		const mcpServers = existingData.mcpServers
		mcpServers[item.id] = mcpData

		await fs.mkdir(path.dirname(filePath), { recursive: true })
		const jsonContent = JSON.stringify(existingData, null, 2)
		await fs.writeFile(filePath, jsonContent, "utf-8")

		const line = findServerLine(jsonContent, item.id)
		return { filePath, line }
	}

	async removeItem(item: MarketplaceItem, options: InstallOptions): Promise<void> {
		const { target } = options

		switch (item.type) {
			case "mode":
				await this.removeMode(item, target)
				break
			case "mcp":
				await this.removeMcp(item, target)
				break
			default:
				throw new Error(`Unsupported item type: ${(item as { type: string }).type}`)
		}
	}

	private async removeMode(item: MarketplaceItem, _target: "project" | "global"): Promise<void> {
		let content: string
		if (Array.isArray(item.content)) {
			content = item.content[0].content
		} else {
			content = item.content || ""
		}

		let modeSlug: string
		try {
			const modeData = yaml.parse(content)
			modeSlug = modeData.slug
		} catch (_error) {
			throw new Error("Invalid mode content: unable to parse YAML")
		}

		if (!modeSlug) {
			throw new Error("Mode missing slug identifier")
		}

		await deleteCustomModeFromFile(modeSlug, this.context, true)
	}

	private async removeMcp(item: MarketplaceItem, target: "project" | "global"): Promise<void> {
		const filePath = await getMcpFilePath(target, this.context)

		try {
			const existing = await fs.readFile(filePath, "utf-8")
			const existingData = JSON.parse(existing)

			if (existingData?.mcpServers) {
				let _content: string
				if (Array.isArray(item.content)) {
					_content = item.content[0].content
				} else {
					_content = item.content
				}

				const removeItemId = item.id
				delete (existingData.mcpServers as { [key: string]: unknown })[removeItemId]

				await fs.writeFile(filePath, JSON.stringify(existingData, null, 2), "utf-8")
			}
		} catch (_error) {
			// File doesn't exist or other error, nothing to remove
		}
	}
}
