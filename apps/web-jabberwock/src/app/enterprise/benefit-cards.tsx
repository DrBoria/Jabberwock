import { CheckCircle, Network, Search, Shield, Workflow, DollarSign, Zap } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface BenefitCardData {
	icon: LucideIcon
	title: string
	description: string
	items: string[]
}

const BENEFIT_CARDS: BenefitCardData[] = [
	{
		icon: Network,
		title: "Centralized AI Management Hub",
		description:
			"Manage Jabberwock deployments enterprise-wide, with an extensible platform ready for your broader AI ecosystem.",
		items: ["Centralized token management", "Multi-model support for Jabberwock", "Extensible architecture"],
	},
	{
		icon: Search,
		title: "Real-Time Usage Visibility",
		description: "Track Jabberwock usage across teams with detailed analytics and cost attribution.",
		items: ["Token consumption tracking", "Cost attribution by team", "AI adoption insights"],
	},
	{
		icon: Shield,
		title: "Enterprise-Grade Governance",
		description:
			"Implement security policies for Jabberwock that align with your enterprise AI governance framework.",
		items: ["Model allow-lists", "Data residency controls", "Audit trail compliance"],
	},
	{
		icon: Workflow,
		title: "5-Minute Control-Plane Setup",
		description:
			"Deploy your Jabberwock control-plane instantly with our SaaS solution. No infrastructure required.",
		items: ["Instant deployment", "SAML/SCIM integration", "REST API access"],
	},
	{
		icon: DollarSign,
		title: "Manage AI Development Costs",
		description: "Track and control Jabberwock costs with detailed analytics and budget controls.",
		items: ["Unified cost visibility", "Department chargebacks", "Usage optimization"],
	},
	{
		icon: Zap,
		title: "Zero Friction for Developers",
		description: "Developers get seamless Jabberwock access while you maintain governance and visibility.",
		items: ["Automatic token refresh", "Local sidecar architecture", "No workflow disruption"],
	},
]

function BenefitCard({ card }: { card: BenefitCardData }) {
	const Icon = card.icon
	return (
		<div className="rounded-lg border border-border bg-card p-6 shadow-sm transition-all hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 dark:hover:border-blue-400/50 dark:hover:shadow-blue-400/10">
			<div className="mb-5 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-2.5 dark:from-blue-500/20 dark:to-cyan-500/20">
				<div className="rounded-lg bg-gradient-to-r from-blue-500/80 to-cyan-500/80 p-2.5">
					<Icon className="h-6 w-6 text-white" />
				</div>
			</div>
			<h3 className="mb-2 text-xl font-bold">{card.title}</h3>
			<p className="text-muted-foreground">{card.description}</p>
			<ul className="mt-4 space-y-2">
				{card.items.map((item) => (
					<li key={item} className="flex items-start">
						<CheckCircle className="mr-2 mt-0.5 h-5 w-5 shrink-0 text-green-500" />
						<span>{item}</span>
					</li>
				))}
			</ul>
		</div>
	)
}

export { BENEFIT_CARDS, BenefitCard }
export type { BenefitCardData }
