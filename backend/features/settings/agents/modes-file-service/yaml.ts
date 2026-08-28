

import * as yaml from "yaml"
import stripBom from "strip-bom"

import { t } from "@i18n"

import { JABBERWOCKMODES_FILENAME, PROBLEMATIC_CHARS_REGEX } from "./types"

/**
 * Regex pattern for problematic characters that need to be cleaned from YAML content
 */

/**
 * Clean invisible and problematic characters from YAML content
 */
export function cleanInvisibleCharacters(content: string): string {
	return content.replace(PROBLEMATIC_CHARS_REGEX, (match) => {
		switch (match) {
			case "\u00A0":
				return " "
			case "\u200B":
			case "\u200C":
			case "\u200D":
				return ""
			case "\u2018":
			case "\u2019":
				return "'"
			case "\u201C":
			case "\u201D":
				return '"'
			default:
				return "-"
		}
	})
}

/**
 * Parse YAML content with enhanced error handling and preprocessing
 */
export function parseYamlSafely(content: string, filePath: string): unknown {
	let cleanedContent = stripBom(content)
	cleanedContent = cleanInvisibleCharacters(cleanedContent)

	try {
		const parsed = yaml.parse(cleanedContent)
		return parsed ?? {}
	} catch (yamlError) {
		if (filePath.endsWith(JABBERWOCKMODES_FILENAME)) {
			try {
				return JSON.parse(content)
			} catch (_jsonError) {
				const errorMsg = yamlError instanceof Error ? yamlError.message : String(yamlError)
				console.error(`[jabberwock] [modesFileService] Failed to parse YAML from ${filePath}:`, errorMsg)

				const lineMatch = errorMsg.match(/at line (\d+)/)
				const line = lineMatch ? lineMatch[1] : "unknown"
				publishNotificationError(t("common:customModes.errors.yamlParseError", { line }))

				return {}
			}
		}

		const errorMsg = yamlError instanceof Error ? yamlError.message : String(yamlError)
		console.error(`[jabberwock] [modesFileService] Failed to parse YAML from ${filePath}:`, errorMsg)
		return {}
	}
}

import { publishNotificationError } from "@features/foundation/capabilities/notifications"
