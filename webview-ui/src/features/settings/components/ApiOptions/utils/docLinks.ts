import { buildDocLink } from "@/utils/misc/docLinks"
import { PROVIDERS } from "../../shared/constants"

export function getDocLinkForProvider(selectedProvider: string | undefined): { url: string; name: string } | undefined {
	const provider = PROVIDERS.find(({ value }) => value === selectedProvider)
	const name = provider?.label
	if (!name) return undefined
	const slugs: Record<string, string> = {
		"openai-native": "openai",
		openai: "openai-compatible",
	}
	const slug = slugs[selectedProvider ?? ""] || selectedProvider
	return { url: buildDocLink(`providers/${slug}`, "provider_docs"), name }
}
