import type { Metadata } from "next"
import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"

const TITLE = "Our Privacy Policy"
const DESCRIPTION =
	"Privacy policy for Jabberwock Cloud and marketing website. Learn how we handle your data and protect your privacy."
const OG_DESCRIPTION = ""
const PATH = "/privacy"

export const privacyMetadata: Metadata = {
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
		type: "article",
	},
	twitter: {
		card: SEO.twitterCard,
		title: TITLE,
		description: DESCRIPTION,
		images: [ogImageUrl(TITLE, OG_DESCRIPTION)],
	},
	keywords: [...SEO.keywords, "privacy", "data protection", "GDPR", "security"],
}
