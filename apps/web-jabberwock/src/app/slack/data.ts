import {
	Brain,
	CreditCard,
	GitBranch,
	GraduationCap,
	Link2,
	MessageSquare,
	Settings,
	Shield,
	Slack,
	Users,
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
		title: "Discussion to PR.",
		description:
			"Your team discusses a feature in Slack. @Roomote turns the discussion into a plan. Then builds it. All without leaving the conversation.",
	},
	{
		icon: Brain,
		title: "Thread-aware.",
		description:
			'@Roomote reads the full thread before responding. Ask "Can we add caching here?" and it knows exactly what code you mean.',
	},
	{
		icon: Link2,
		title: "Chain agents.",
		description:
			"Start with a Planner to spec it out. Then call the Coder to build it. Multi-step workflows, one Slack thread.",
	},
	{
		icon: Users,
		title: "Open to all.",
		description:
			"Anyone on your team can ask @Roomote to fix bugs, build features, or investigate issues. Engineering gets looped in only when needed.",
	},
	{
		icon: GraduationCap,
		title: "Built-in learning.",
		description: "Public channel mentions show everyone how to leverage agents. Learn by watching.",
	},
	{
		icon: Shield,
		title: "Safe by design.",
		description: "Agents never touch main/master directly. They produce branches and PRs. You approve.",
	},
]

type WorkflowStep = {
	step: number
	title: string
	description: string
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
	{
		step: 1,
		title: "Turn the discussion into a plan",
		description: "Your team discusses a feature. When it gets complex, summon the Planner agent.",
	},
	{
		step: 2,
		title: "Refine the plan in the thread",
		description:
			"The team reviews the spec in the thread, suggests changes, asks questions. Mention @Roomote again to refine.",
	},
	{
		step: 3,
		title: "Build the plan",
		description: "Once the plan looks good, hand it off to the Coder agent to implement.",
	},
	{
		step: 4,
		title: "Review and ship",
		description: "The Coder creates a branch and opens a PR. The team reviews, and the feature ships.",
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
		description: "Slack requires a Team plan.",
		link: { href: EXTERNAL_LINKS.CLOUD_APP_TEAM_TRIAL, text: "Start a free trial" },
	},
	{
		icon: Settings,
		title: "2. Connect",
		description: 'Sign in to Jabberwock Cloud and go to Settings. Click "Connect" next to Slack.',
	},
	{
		icon: Slack,
		title: "3. Authorize",
		description: "Authorize the Jabberwock app to access your Slack workspace.",
	},
	{
		icon: MessageSquare,
		title: "4. Add to channels",
		description: "Add @Roomote to the channels where you want it available.",
	},
]
