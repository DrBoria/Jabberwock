import { ArrowRight, Slack, Zap } from "lucide-react"

import { AnimatedBackground } from "@/components/homepage"
import { SlackThreadDemo } from "@/components/slack/thread-demo"
import { Button } from "@/components/ui"
import { EXTERNAL_LINKS } from "@/lib/constants"
import { VALUE_PROPS, WORKFLOW_STEPS, ONBOARDING_STEPS } from "./data"
import { slackMetadata } from "./meta"
import { ValuePropCard, WorkflowStepItem, OnboardingStepCard } from "./sections"

export const metadata = slackMetadata

export const revalidate = 3600

export default function SlackPage(): JSX.Element {
	return (
		<>
			<section className="relative flex pt-32 pb-20 items-center overflow-hidden">
				<AnimatedBackground />
				<div className="container relative flex flex-col items-center h-full z-10 mx-auto px-4 sm:px-6 lg:px-8">
					<div className="grid w-full max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
						<div className="text-center lg:text-left">
							<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-sm font-medium mb-6">
								<Slack className="size-4" />
								Powered by Jabberwock Cloud
							</div>
							<h1 className="text-4xl font-bold tracking-tight mb-6 md:text-5xl lg:text-6xl">
								<span className="text-violet-500">@Roomote:</span> Your AI Team in&nbsp;Slack
							</h1>
							<p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto lg:mx-0">
								Mention @Roomote in any channel to explain code, plan features, or ship a PR, all
								without leaving the conversation.
							</p>
							<div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
								<Button
									size="xl"
									className="bg-violet-600 hover:bg-violet-700 text-white transition-all duration-300 shadow-lg hover:shadow-violet-500/25"
									asChild>
									<a
										href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center justify-center">
										Get Started <ArrowRight className="ml-2 size-5" />
									</a>
								</Button>
								<Button variant="outline" size="xl" className="backdrop-blur-sm" asChild>
									<a
										href={EXTERNAL_LINKS.SLACK_DOCS}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center justify-center">
										Read the Docs
									</a>
								</Button>
							</div>
						</div>
						<div className="flex justify-center lg:justify-end">
							<SlackThreadDemo />
						</div>
					</div>
				</div>
			</section>

			<section className="py-24 bg-muted/30">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
					<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2 z-1">
						<div className="absolute left-1/2 top-1/2 h-[800px] w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/10 dark:bg-violet-700/20 blur-[140px]" />
					</div>
					<div className="text-center mb-16">
						<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
							Why your team will love using Jabberwock in&nbsp;Slack
						</h2>
						<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
							AI agents that understand context, chain together for complex work, and keep your team in
							control.
						</p>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto relative">
						{VALUE_PROPS.map((prop, index) => (
							<ValuePropCard key={index} prop={prop} />
						))}
					</div>
				</div>
			</section>

			<section className="relative overflow-hidden border-t border-border py-24 lg:py-32">
				<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
					<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2 z-1">
						<div className="absolute left-1/2 top-1/2 h-[400px] w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 dark:bg-blue-700/20 blur-[140px]" />
					</div>
					<div className="mx-auto mb-12 max-w-5xl text-center">
						<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium mb-6">
							<Zap className="size-4" />
							Featured Workflow
						</div>
						<h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-4">
							Thread to Shipped Feature
						</h2>
						<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
							Turn Slack discussions into working code. No context lost, no meetings needed.
						</p>
					</div>
					<div className="relative mx-auto max-w-6xl">
						<div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-10 items-center">
							<div className="lg:col-span-3 overflow-hidden rounded-2xl border border-border bg-background shadow-lg">
								<iframe
									className="aspect-video w-full"
									src="https://www.youtube-nocookie.com/embed/dJM_8HHGe1E?rel=0"
									title="Jabberwock Slack Integration Demo"
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
									referrerPolicy="strict-origin-when-cross-origin"
									allowFullScreen
								/>
							</div>
							<div className="lg:col-span-2 space-y-3">
								{WORKFLOW_STEPS.map((step) => (
									<WorkflowStepItem key={step.step} step={step} />
								))}
							</div>
						</div>
					</div>
				</div>
			</section>

			<section className="py-24 bg-muted/30">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center mb-16">
						<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Get started in minutes</h2>
						<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
							Connect your Slack workspace and start working with AI agents.
						</p>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
						{ONBOARDING_STEPS.map((step, index) => (
							<OnboardingStepCard key={index} step={step} />
						))}
					</div>
				</div>
			</section>

			<section className="py-24">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mx-auto max-w-4xl rounded-3xl border border-border/50 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-blue-500/5 p-8 text-center shadow-2xl backdrop-blur-xl dark:border-white/10 sm:p-16">
						<h2 className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl">
							Start using Jabberwock in Slack
						</h2>
						<p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
							Start a free 14 day Team trial.
						</p>
						<div className="flex flex-col justify-center space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
							<Button
								size="lg"
								className="bg-foreground text-background hover:bg-foreground/90 transition-all duration-300"
								asChild>
								<a
									href={EXTERNAL_LINKS.CLOUD_APP_TEAM_TRIAL}
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center justify-center">
									Start free trial <ArrowRight className="ml-2 h-4 w-4" />
								</a>
							</Button>
						</div>
					</div>
				</div>
			</section>
		</>
	)
}
