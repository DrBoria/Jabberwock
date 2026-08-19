import type { Metadata } from "next"
import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"

const TITLE = "Our Cookie Policy"
const DESCRIPTION = "Learn about how Jabberwock uses cookies to enhance your experience and provide our services."
const OG_DESCRIPTION = ""
const PATH = "/legal/cookies"

export const cookiesMetadata: Metadata = {
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
		type: "article",
	},
	twitter: {
		card: SEO.twitterCard,
		title: TITLE,
		description: DESCRIPTION,
		images: [ogImageUrl(TITLE, OG_DESCRIPTION)],
	},
	keywords: [...SEO.keywords, "cookies", "privacy", "tracking", "analytics"],
}
