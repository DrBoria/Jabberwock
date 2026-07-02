import { z } from "zod"

/**
 * CodeAction
 */

export const codeActionIds = ["explainCode", "fixCode", "improveCode", "addToContext", "newTask"] as const

export type CodeActionId = (typeof codeActionIds)[number]

export type CodeActionName = "EXPLAIN" | "FIX" | "IMPROVE" | "ADD_TO_CONTEXT" | "NEW_TASK"

/**
 * TerminalAction
 */

export const terminalActionIds = ["terminalAddToContext", "terminalFixCommand", "terminalExplainCommand"] as const

export type TerminalActionId = (typeof terminalActionIds)[number]

export type TerminalActionName = "ADD_TO_CONTEXT" | "FIX" | "EXPLAIN"

export type TerminalActionPromptType = `TERMINAL_${TerminalActionName}`

/**
 * Command
 */

export const commandIds = [
	"activationCompleted",

	"plusButtonClicked",
	"historyButtonClicked",
	"marketplaceButtonClicked",
	"popoutButtonClicked",
	"cloudButtonClicked",
	"settingsButtonClicked",

	"openInNewTab",

	"newChat",

	"setCustomStoragePath",
	"importSettings",

	"focusInput",
	"acceptInput",
	"focusPanel",
	"toggleAutoApprove",
] as const

export type CommandId = (typeof commandIds)[number]

/**
 * Language
 */

export const languages = [
	"ca",
	"de",
	"en",
	"es",
	"fr",
	"hi",
	"id",
	"it",
	"ja",
	"ko",
	"nl",
	"pl",
	"pt-BR",
	"ru",
	"tr",
	"vi",
	"zh-CN",
	"zh-TW",
] as const

export const languagesSchema = z.enum(languages)

export type Language = z.infer<typeof languagesSchema>

/**
 * Type guard to check if a string is a known language.
 */
const languageLookup: Record<string, true> = {
	ca: true,
	de: true,
	en: true,
	es: true,
	fr: true,
	hi: true,
	id: true,
	it: true,
	ja: true,
	ko: true,
	nl: true,
	pl: true,
	"pt-BR": true,
	ru: true,
	tr: true,
	vi: true,
	"zh-CN": true,
	"zh-TW": true,
}

export const isLanguage = (key: string): key is Language => languageLookup[key] === true
