import type { Metadata } from "next"

import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"

const TITLE = "Jabberwock Pricing"
const DESCRIPTION =
	"Simple, transparent pricing for all Jabberwock products. The VS Code extension is free forever. Choose the cloud plan that fits your needs."
const OG_DESCRIPTION = ""
const PATH = "/pricing"

export const pricingMetadata: Metadata = {
	title: TITLE,
	description: DESCRIPTION,
	alternates: { canonical: `${SEO.url}${PATH}` },
	openGraph: {
		title: TITLE,
		description: DESCRIPTION,
		url: `${SEO.url}${PATH}`,
		siteName: SEO.name,
		images: [{ url: ogImageUrl(TITLE, OG_DESCRIPTION), width: 1200, height: 630, alt: TITLE }],
		locale: SEO.locale,
		type: "website",
	},
	twitter: {
		card: SEO.twitterCard,
		title: TITLE,
		description: DESCRIPTION,
		images: [ogImageUrl(TITLE, OG_DESCRIPTION)],
	},
	keywords: [
		...SEO.keywords,
		"pricing",
		"plans",
		"subscription",
		"cloud pricing",
		"AI development pricing",
		"team pricing",
		"enterprise pricing",
	],
}
