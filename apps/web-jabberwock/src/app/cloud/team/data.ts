import {
	BarChart3,
	DollarSign,
	Lock,
	LucideIcon,
	Puzzle,
	Server,
	ServerIcon,
	Settings,
	Share2,
	ShieldCheck,
	RefreshCcw,
	Users,
} from "lucide-react"

export interface Feature {
	icon: LucideIcon
	title: string
	description: string
}

export const keyBenefits: Feature[] = [
	{
		title: "No Per-Seat Costs",
		description: "Add unlimited team members without worrying about escalating per-seat charges.",
		icon: Users,
	},
	{
		title: "Centralized Billing",
		description:
			"Single billing point for all team members using Cloud Agents and the Jabberwock Router. No more API key management.",
		icon: DollarSign,
	},
	{
		title: "Unified Integrations",
		description:
			"Connect GitHub, Slack, and Linear once for the entire team. No need for each member to set up individual integrations.",
		icon: Settings,
	},
	{
		title: "Team-Wide Visibility",
		description: "Access task history and usage analytics across your entire team with granular per-user filters.",
		icon: BarChart3,
	},
	{
		title: "Configuration Enforcement",
		description:
			"Set policies for providers, models, and MCP servers to ensure your team follows organizational standards.",
		icon: ShieldCheck,
	},
	{
		title: "Secure Environment Variables",
		description:
			"Centrally manage secrets, API keys, and environment variables for Cloud Agents in our encrypted secret store.",
		icon: Lock,
	},
]

export const features: Feature[] = [
	{
		icon: ShieldCheck,
		title: "Configuration Enforcement",
		description:
			"Require team members to log in to the VS Code Extension so policies can be enforced via MDM distribution.",
	},
	{
		icon: Server,
		title: "Provider Management",
		description:
			"Configure and manage the model providers your team can access for both the Extension and Cloud Agents, with API-key-free management.",
	},
	{
		icon: Puzzle,
		title: "Centralized Integration",
		description:
			"Centralized GitHub, Slack, and Linear connection for the entire team. Agents can review PRs, collaborate on your repositories, respond on your team Slack channels, and work on issues in Linear.",
	},
	{
		icon: RefreshCcw,
		title: "Extension Task Sync Config",
		description:
			"Require task syncing from VS Code Extension and control visibility settings for who can view each other's tasks.",
	},
	{
		icon: Share2,
		title: "Task Sharing Controls",
		description: "Enable per-task sharing with customizable audience controls and link expiration times.",
	},
	{
		icon: ServerIcon,
		title: "MCP Server Controls",
		description:
			"Control access to the Jabberwock MCP Marketplace and what custom MCPs to make available to your team.",
	},
]
