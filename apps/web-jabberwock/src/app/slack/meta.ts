import type { Metadata } from "next"
import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"

const TITLE = "Jabberwock for Slack"
const DESCRIPTION =
	"Mention @Roomote in any channel to explain code, plan features, or ship a PR, all without leaving the conversation."
const OG_DESCRIPTION = "Your AI Team in Slack"
const PATH = "/slack"

export const slackMetadata: Metadata = {
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
		"slack integration",
		"slack bot",
		"AI in slack",
		"code assistant slack",
		"@Roomote",
		"team collaboration",
	],
}
