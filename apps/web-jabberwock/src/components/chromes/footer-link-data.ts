import { EXTERNAL_LINKS, INTERNAL_LINKS } from "@/lib/constants"

export interface FooterLink {
	label: string
	href?: string
	external?: boolean
	scrollTarget?: string
}

export interface FooterColumn {
	title: string
	links: (FooterLink | { label: string; type: "dropdown"; key: string; items: FooterLink[] })[]
}

export interface FooterDropdown {
	label: string
	buttonLabel: string
	items: FooterLink[]
}

export const PRODUCT_LINKS: (FooterLink | { label: string; type: "dropdown"; key: string; items: FooterLink[] })[] = [
	{ label: "Features", scrollTarget: "product" },
	{
		label: "Cloud Agents",
		type: "dropdown",
		key: "cloud",
		items: [
			{ label: "Cloud", href: "/cloud" },
			{ label: "PR Reviewer", href: "/reviewer" },
			{ label: "PR Fixer", href: "/pr-fixer" },
		],
	},
	{ label: "Docs", href: EXTERNAL_LINKS.DOCUMENTATION, external: true },
	{ label: "Changelog", href: EXTERNAL_LINKS.CHANGELOG, external: true },
	{ label: "Testimonials", href: EXTERNAL_LINKS.TESTIMONIALS, external: true },
	{ label: "Enterprise", href: "/enterprise" },
	{ label: "Security Center", href: EXTERNAL_LINKS.SECURITY, external: true },
]

export const RESOURCES_LINKS: FooterLink[] = [
	{ label: "Blog", href: "/blog" },
	{ label: "Evals", href: EXTERNAL_LINKS.EVALS, external: true },
	{ label: "FAQ", href: EXTERNAL_LINKS.FAQ, external: true },
	{ label: "Tutorials", href: EXTERNAL_LINKS.TUTORIALS, external: true },
	{ label: "Issues", href: EXTERNAL_LINKS.ISSUES, external: true },
	{ label: "Feature Requests", href: EXTERNAL_LINKS.FEATURE_REQUESTS, external: true },
	{ label: "Office Hours Podcast", href: EXTERNAL_LINKS.OFFICE_HOURS_PODCAST, external: true },
]

export const COMPANY_LINKS: (FooterLink | { label: string; type: "dropdown"; key: string; items: FooterLink[] })[] = [
	{ label: "Contact", href: "mailto:support@jabberwock.com" },
	{ label: "Careers", href: EXTERNAL_LINKS.CAREERS, external: true },
	{ label: "Terms of Service", href: "/terms" },
	{
		label: "Privacy Policy",
		type: "dropdown",
		key: "privacy",
		items: [
			{ label: "Extension", href: EXTERNAL_LINKS.PRIVACY_POLICY_EXTENSION, external: true },
			{ label: "Jabberwock Cloud", href: INTERNAL_LINKS.PRIVACY_POLICY_WEBSITE },
		],
	},
	{ label: "Cookie Policy", href: "/legal/cookies" },
	{ label: "Subprocessors", href: "/legal/subprocessors" },
]

export const CONNECT_LINKS: FooterLink[] = [
	{ label: "GitHub", href: EXTERNAL_LINKS.GITHUB, external: true },
	{ label: "Discord", href: EXTERNAL_LINKS.DISCORD, external: true },
	{ label: "Reddit", href: EXTERNAL_LINKS.REDDIT, external: true },
	{ label: "X / Twitter", href: EXTERNAL_LINKS.X, external: true },
	{ label: "LinkedIn", href: EXTERNAL_LINKS.LINKEDIN, external: true },
	{ label: "Bluesky", href: EXTERNAL_LINKS.BLUESKY, external: true },
	{ label: "TikTok", href: EXTERNAL_LINKS.TIKTOK, external: true },
	{ label: "YouTube", href: EXTERNAL_LINKS.YOUTUBE, external: true },
]
