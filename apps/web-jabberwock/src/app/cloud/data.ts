import {
	Github,
	Users2,
	Pencil,
	Bot,
	Brain,
	ChartLine,
	History,
	ListChecks,
	LucideIcon,
	Share2,
	Slack,
	Users,
} from "lucide-react"

interface Step {
	title: string
	description: string
	icon: LucideIcon
}

export interface Feature {
	icon: LucideIcon
	title: string
	description: string
}

export const howItWorks: Step[] = [
	{
		title: "1. Connect your GitHub account",
		description:
			"Pick which repos the agents can work with in their isolated containers and choose what model you want to power each of them. You're in control.",
		icon: Github,
	},
	{
		title: "2. Set up your agent team",
		description:
			"Choose the roles you want filled, like Explainer, Planner, Coder, PR Reviewer and PR Fixer. They know how to act in each situation and stay on-task with no deviations.",
		icon: Users2,
	},
	{
		title: "3. Start giving them tasks",
		description:
			"Describe what you want them to do from the web UI, get the Reviewer automatically reviewing PRs, and much more. They're now part of your team.",
		icon: Pencil,
	},
]

export const features: Feature[] = [
	{
		icon: Bot,
		title: "Autonomous Cloud Agents",
		description:
			"Delegate work to specialized agents like the Planner, Coder, Explainer, Reviewer, and Fixer that run 24/7.",
	},
	{
		icon: Brain,
		title: "Model Agnostic",
		description: "Bring your own keys or use the Jabberwock Router with access to all top models with no markup.",
	},
	{
		icon: Github,
		title: "GitHub PR Reviews",
		description:
			"Agents can automatically review Pull Requests, provide feedback, and even push fixes directly to your repository.",
	},
	{
		icon: Slack,
		title: "Slack Integration",
		description: "Start tasks, get updates, and collaborate with agents directly from your team's Slack channels.",
	},
	{
		icon: ListChecks,
		title: "Linear Integration",
		description: "Assign issues to Jabberwock directly from Linear. Get PRs back without switching tools.",
	},
	{
		icon: Users,
		title: "Team Collaboration",
		description:
			"Manage your team and their access to tasks and resources, with centralized billing and configuration.",
	},
	{
		icon: ChartLine,
		title: "Usage Analytics",
		description: "Detailed token analytics to help you optimize your costs and usage across your team.",
	},
	{
		icon: History,
		title: "Task History",
		description: "Access from anywhere all of your tasks, from the cloud and the extension",
	},
	{
		icon: Share2,
		title: "Task Sharing",
		description: "Share tasks with friends and co-workers and let them follow your work in real-time.",
	},
]
