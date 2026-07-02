import { LanguageModelChatSelector } from "vscode"

export const SELECTOR_SEPARATOR = "/"

export function stringifyVsCodeLmModelSelector(selector: LanguageModelChatSelector): string {
	const parts = [selector.vendor, selector.family, selector.version].filter(Boolean)
	return selector.id || parts.join(SELECTOR_SEPARATOR)
}
