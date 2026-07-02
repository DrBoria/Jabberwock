import * as fs from "fs/promises"
import * as path from "path"

import type { MarketplaceItem, McpParameter } from "@jabberwock/types"

export function resolveContent(item: MarketplaceItem, selectedIndex?: number): string {
	if (!Array.isArray(item.content)) {
		return item.content
	}
	const index = selectedIndex ?? 0
	const method = item.content[index] || item.content[0]
	return method.content
}

export function resolveMethodParameters(item: MarketplaceItem, selectedIndex?: number): McpParameter[] {
	if (!Array.isArray(item.content)) {
		return []
	}
	const index = selectedIndex ?? 0
	const method = item.content[index] || item.content[0]
	return method.parameters || []
}

export function mergeParameters(item: MarketplaceItem, methodParameters: McpParameter[]): McpParameter[] {
	const itemParameters = item.type === "mcp" ? item.parameters || [] : []
	const allParameters = [...itemParameters, ...methodParameters]
	return Array.from(new Map(allParameters.map((p) => [p.key, p])).values())
}

export function applyParameterReplacements(
	content: string,
	parameters: Record<string, string>,
	paramDefs: McpParameter[],
): string {
	let result = content
	for (const param of paramDefs) {
		const value = parameters[param.key]
		if (value !== undefined) {
			result = result.replace(new RegExp(`{{${param.key}}}`, "g"), String(value))
		}
	}
	return result
}

export function resolveSelectedIndexOverride(
	item: MarketplaceItem,
	currentContent: string,
	currentMethodParameters: McpParameter[],
	parameters?: Record<string, unknown>,
): string {
	const selectedIndex = parameters?._selectedIndex as number | undefined
	if (selectedIndex === undefined || !Array.isArray(item.content)) {
		return currentContent
	}
	if (selectedIndex < 0 || selectedIndex >= item.content.length) {
		return currentContent
	}

	const method = item.content[selectedIndex]
	let newContent = method.content
	const newMethodParameters = method.parameters || []
	const mergedParams = mergeParameters(item, newMethodParameters)

	if (parameters) {
		const stringParams = Object.fromEntries(Object.entries(parameters).map(([key, value]) => [key, String(value)]))
		newContent = applyParameterReplacements(newContent, stringParams, mergedParams)
	}

	return newContent
}

export async function readMcpFile(filePath: string): Promise<{ mcpServers: Record<string, unknown> }> {
	try {
		const existing = await fs.readFile(filePath, "utf-8")
		return JSON.parse(existing) || { mcpServers: {} }
	} catch (error) {
		const nodeError = error as NodeJS.ErrnoException
		if (nodeError.code === "ENOENT") {
			return { mcpServers: {} }
		}
		if (error instanceof SyntaxError) {
			const fileName = path.basename(filePath)
			throw new Error(
				`Cannot install MCP server: The ${fileName} file contains invalid JSON. ` +
					`Please fix the syntax errors in the file before installing new servers.`,
			)
		}
		throw error
	}
}

export function findServerLine(jsonContent: string, serverId: string): number | undefined {
	if (!serverId) {
		return undefined
	}
	const lines = jsonContent.split("\n")
	const serverLineIndex = lines.findIndex((l) => l.includes(`"${serverId}"`))
	return serverLineIndex >= 0 ? serverLineIndex + 1 : undefined
}
