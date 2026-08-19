import { supportPromptConfigs } from "./config"
import type { VSCodeDiagnostic, SupportPromptType } from "./config"

type PromptParams = Record<string, string | VSCodeDiagnostic[]>

const generateDiagnosticText = (diagnostics?: VSCodeDiagnostic[]) => {
	if (!diagnostics?.length) return ""
	return `\nCurrent problems detected:\n${diagnostics
		.map((d) => `- [${d.source || "Error"}] ${d.message}${d.code ? ` (${d.code})` : ""}`)
		.join("\n")}`
}

const createPrompt = (template: string, params: PromptParams): string => {
	return template.replace(/\${(.*?)}/g, (_, key) => {
		if (key === "diagnosticText") {
			return generateDiagnosticText(params["diagnostics"] as VSCodeDiagnostic[])
		} else if (Object.prototype.hasOwnProperty.call(params, key)) {
			const value = params[key]
			if (typeof value === "string") {
				return value
			} else {
				return String(value)
			}
		} else {
			return ""
		}
	})
}

const supportPrompt = {
	default: Object.fromEntries(Object.entries(supportPromptConfigs).map(([key, config]) => [key, config.template])),
	get: (customSupportPrompts: Record<string, string | undefined> | undefined, type: SupportPromptType): string => {
		return customSupportPrompts?.[type] ?? supportPromptConfigs[type].template
	},
	create: (
		type: SupportPromptType,
		params: PromptParams,
		customSupportPrompts?: Record<string, string | undefined>,
	): string => {
		const template = supportPrompt.get(customSupportPrompts, type)
		return createPrompt(template, params)
	},
} as const

export type CustomSupportPrompts = {
	[key: string]: string | undefined
}

export { supportPrompt, createPrompt }
export type { SupportPromptType, PromptParams }
