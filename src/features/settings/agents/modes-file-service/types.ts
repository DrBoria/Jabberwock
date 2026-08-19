import { type ModeConfig } from "@jabberwock/types"

export const JABBERWOCKMODES_FILENAME = ".jabberwockmodes"

export const CACHE_TTL = 10_000

export const PROBLEMATIC_CHARS_REGEX =
	/[\u00A0\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u2018\u2019\u201C\u201D]|[\u200B\u200C\u200D]/gu

export interface RuleFile {
	relativePath: string
	content: string
}

export interface ExportedModeConfig extends ModeConfig {
	rulesFiles?: RuleFile[]
}

export interface ImportData {
	customModes: ExportedModeConfig[]
}

export interface ExportResult {
	success: boolean
	yaml?: string
	error?: string
}

export interface ImportResult {
	success: boolean
	slug?: string
	error?: string
}
