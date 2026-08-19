import type { LucideIcon } from "lucide-react"

type ValueProp = {
	icon: LucideIcon
	title: string
	description: string
}

type WorkflowStep = {
	step: number
	title: string
	description: string
}

type OnboardingStep = {
	icon: LucideIcon
	title: string
	description: string
	link?: {
		href: string
		text: string
	}
}

function ValuePropCard({ prop }: { prop: ValueProp }) {
	const Icon = prop.icon
	return (
		<div className="bg-background p-8 rounded-2xl border border-border hover:shadow-lg transition-all duration-300">
			<div className="bg-violet-100 dark:bg-violet-900/20 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
				<Icon className="size-6 text-violet-600 dark:text-violet-400" />
			</div>
			<h3 className="text-xl font-semibold mb-3">{prop.title}</h3>
			<p className="text-muted-foreground leading-relaxed">{prop.description}</p>
		</div>
	)
}

function WorkflowStepItem({ step: stepData }: { step: WorkflowStep }) {
	return (
		<div className="relative border border-border rounded-xl bg-background p-4 transition-all duration-300 hover:shadow-md hover:border-blue-500/30">
			<div className="flex items-start gap-3">
				<div className="bg-blue-100 dark:bg-blue-900/30 w-7 h-7 rounded-full flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-xs shrink-0 mt-0.5">
					{stepData.step}
				</div>
				<div className="min-w-0">
					<h3 className="text-base font-semibold text-foreground mb-0.5">{stepData.title}</h3>
					<p className="text-sm leading-snug text-muted-foreground">{stepData.description}</p>
				</div>
			</div>
		</div>
	)
}

function OnboardingStepCard({ step }: { step: OnboardingStep }) {
	const Icon = step.icon
	return (
		<div className="text-center">
			<div className="bg-violet-100 dark:bg-violet-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
				<Icon className="size-8 text-violet-600 dark:text-violet-400" />
			</div>
			<h3 className="text-lg font-semibold mb-2">{step.title}</h3>
			<p className="text-muted-foreground">
				{step.description}
				{step.link && (
					<>
						{" "}
						<a
							href={step.link.href}
							target="_blank"
							rel="noopener noreferrer"
							className="text-violet-600 dark:text-violet-400 hover:underline">
							{step.link.text} →
						</a>
					</>
				)}
			</p>
		</div>
	)
}

export { ValuePropCard, WorkflowStepItem, OnboardingStepCard }
