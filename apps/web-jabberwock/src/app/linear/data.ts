import {
	CheckCircle,
	CreditCard,
	Eye,
	GitBranch,
	GitPullRequest,
	Link2,
	MessageSquare,
	Settings,
	Shield,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { EXTERNAL_LINKS } from "@/lib/constants"

type ValueProp = {
	icon: LucideIcon
	title: string
	description: string
}

export const VALUE_PROPS: ValueProp[] = [
	{
		icon: GitBranch,
		title: "Work where you already work.",
		description:
			"Assign development work to @Jabberwock directly from Linear. No new tools to learn, no context switching required.",
	},
	{
		icon: Eye,
		title: "Progress is visible.",
		description:
			"Watch progress unfold in real-time. Jabberwock posts updates as comments, so your whole team stays in the loop.",
	},
	{
		icon: MessageSquare,
		title: "Mention for refinement.",
		description:
			'Need changes? Just comment "@Jabberwock also add dark mode support" and the agent picks up where it left off.',
	},
	{
		icon: Link2,
		title: "Full traceability.",
		description:
			"Every PR links back to the originating issue. Every issue shows its linked PR. Your audit trail stays clean.",
	},
	{
		icon: Settings,
		title: "Organization-level setup.",
		description:
			"Connect once, use everywhere. Your team members can assign issues to @Jabberwock without individual configuration.",
	},
	{
		icon: Shield,
		title: "Safe by design.",
		description:
			"Agents never touch main/master directly. They produce branches and PRs. You review and approve before merge.",
	},
]

type OnboardingStep = {
	icon: LucideIcon
	title: string
	description: string
	link?: {
		href: string
		text: string
	}
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
	{
		icon: CreditCard,
		title: "1. Team Plan",
		description: "Linear integration requires a Team plan.",
		link: { href: EXTERNAL_LINKS.CLOUD_APP_TEAM_TRIAL, text: "Start a free trial" },
	},
	{
		icon: GitPullRequest,
		title: "2. Connect GitHub",
		description: "Link your repositories so Jabberwock can open PRs on your behalf.",
	},
	{
		icon: Settings,
		title: "3. Connect Linear",
		description: "Authorize via OAuth. No API keys to manage or rotate.",
	},
	{
		icon: CheckCircle,
		title: "4. Link & Start",
		description: "Map your Linear project to a repo, then assign or mention @Jabberwock.",
	},
]
