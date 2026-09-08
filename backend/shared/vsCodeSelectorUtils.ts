/**
 * Minimal structural type for a VS Code language-model chat selector.
 *
 * Captures only the members this module actually reads, so the file stays
 * host-neutral and no longer imports "vscode". The real
 * `vscode.LanguageModelChatSelector` remains assignable (all members optional).
 */
interface ILmModelSelectorLike {
	id?: string
	vendor?: string
	family?: string
	version?: string
}

export const SELECTOR_SEPARATOR = "/"

export function stringifyVsCodeLmModelSelector(selector: ILmModelSelectorLike): string {
	const parts = [selector.vendor, selector.family, selector.version].filter(Boolean)
	return selector.id || parts.join(SELECTOR_SEPARATOR)
}
