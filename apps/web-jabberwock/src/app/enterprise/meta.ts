import type { Metadata } from "next"
import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"

const TITLE = "Jabberwock Cloud Enterprise"
const DESCRIPTION =
	"The control-plane for AI-powered software development. Gain visibility, governance, and control over your AI coding initiatives."
const OG_DESCRIPTION = "The control-plane for AI-powered software development"
const PATH = "/enterprise"

export const enterpriseMetadata: Metadata = {
	title: TITLE,
	description: DESCRIPTION,
	alternates: {
		canonical: `${SEO.url}${PATH}`,
	},
	openGraph: {
		title: TITLE,
		description: DESCRIPTION,
		url: `${SEO.url}${PATH}`,
		siteName: SEO.name,
		images: [
			{
				url: ogImageUrl(TITLE, OG_DESCRIPTION),
				width: 1200,
				height: 630,
				alt: TITLE,
			},
		],
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
		"Enterprise AI",
		"AI governance",
		"AI control-plane",
		"developer productivity",
		"SAML",
		"SCIM",
		"cost management",
	],
}
