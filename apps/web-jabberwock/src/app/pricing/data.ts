import { Users, SquareTerminal, Cloud } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { EXTERNAL_LINKS } from "@/lib/constants"

const PRICE_CREDITS = 5

export interface PricingTier {
	name: string
	icon: LucideIcon
	price: string
	priceSuffix: string
	period?: string
	creditPrice?: string
	trial?: string
	description: string
	featuresIntro?: string
	features: string[]
	cta: {
		text: string
		href?: string
	}
	learnMoreLink?: string
}

export const pricingTiers: PricingTier[] = [
	{
		name: "VS Code Extension",
		icon: SquareTerminal,
		price: "Free",
		priceSuffix: "inference",
		description: "The best local coding agent",
		features: ["Unlimited local use", "Bring your own model", "Powerful, extensible modes", "Community support"],
		cta: { text: "Install Now", href: EXTERNAL_LINKS.MARKETPLACE },
	},
	{
		name: "Cloud Free",
		icon: Cloud,
		price: "$0",
		period: "/mo",
		priceSuffix: "credits",
		creditPrice: `$${PRICE_CREDITS}`,
		description: "For AI-forward engineers",
		featuresIntro: "Go beyond the extension with",
		features: [
			"Access to Cloud Agents: fully autonomous development you can kick off from GitHub and the web",
			"Access to the Jabberwock Router",
			"Follow your tasks from anywhere",
			"Share tasks with friends and co-workers",
			"Token usage analytics",
			"Professional support",
		],
		cta: { text: "Sign up", href: EXTERNAL_LINKS.CLOUD_APP_SIGNUP },
	},
	{
		name: "Cloud Team",
		icon: Users,
		price: "$99",
		priceSuffix: "credits",
		period: "/mo",
		creditPrice: `$${PRICE_CREDITS}`,
		trial: "Free for 14 days, then",
		description: "For AI-forward teams",
		featuresIntro: "Everything in Free +",
		features: [
			"Unlimited users (no per-seat cost)",
			"Shared configuration & policies",
			"Centralized billing",
			"Slack and Linear integrations",
		],
		cta: { text: "Sign up", href: EXTERNAL_LINKS.CLOUD_APP_SIGNUP + "?redirect_url=/billing" },
		learnMoreLink: "/cloud/team",
	},
]
