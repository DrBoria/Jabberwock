import { ArrowRight } from "lucide-react"
import type { Metadata } from "next"

import { AnimatedBackground } from "@/components/homepage"
import { LinearIssueDemo } from "@/components/linear/issue-demo"
import { LinearIcon } from "@/components/linear/icon"
import { Button } from "@/components/ui"
import { EXTERNAL_LINKS } from "@/lib/constants"
import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { VALUE_PROPS, ONBOARDING_STEPS } from "./data"

const TITLE = "Jabberwock for Linear"
const DESCRIPTION = "Assign development work to @Jabberwock directly from Linear. Get PRs back without switching tools."
const OG_DESCRIPTION = "Turn Linear Issues into Pull Requests"
const PATH = "/linear"

export const metadata: Metadata = {
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
		"linear integration",
		"issue to PR",
		"AI in Linear",
		"engineering workflow automation",
		"Jabberwock Cloud",
	],
}

export const revalidate = 3600

export default function LinearPage(): JSX.Element {
	return (
		<>
			<section className="relative flex pt-32 pb-20 items-center overflow-hidden">
				<AnimatedBackground />
				<div className="container relative flex flex-col items-center h-full z-10 mx-auto px-4 sm:px-6 lg:px-8">
					<div className="grid w-full max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
						<div className="text-center lg:text-left">
							<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-medium mb-6">
								<LinearIcon className="size-4" />
								Powered by Jabberwock Cloud
							</div>
							<h1 className="text-4xl font-bold tracking-tight mb-6 md:text-5xl lg:text-6xl">
								Turn Linear Issues into <span className="text-indigo-500">Pull&nbsp;Requests</span>
							</h1>
							<p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto lg:mx-0">
								Assign development work to @Jabberwock directly from Linear. Get PRs back without
								switching tools.
							</p>
							<div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
								<Button
									size="xl"
									className="bg-indigo-600 hover:bg-indigo-700 text-white transition-all duration-300 shadow-lg hover:shadow-indigo-500/25"
									asChild>
									<a
										href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP_HOME}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center justify-center">
										Get Started
										<ArrowRight className="ml-2 size-5" />
									</a>
								</Button>
							</div>
						</div>
						<div className="flex justify-center lg:justify-end">
							<LinearIssueDemo />
						</div>
					</div>
				</div>
			</section>

			<section className="py-24 bg-muted/30">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
					<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2 z-1">
						<div className="absolute left-1/2 top-1/2 h-[800px] w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 dark:bg-indigo-700/20 blur-[140px]" />
					</div>
					<div className="text-center mb-16">
						<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
							Why your team will love using Jabberwock in&nbsp;Linear
						</h2>
						<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
							AI agents that understand context, keep your team in the loop, and deliver PRs you can
							review.
						</p>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto relative">
						{VALUE_PROPS.map((prop, index) => {
							const Icon = prop.icon
							return (
								<div
									key={index}
									className="bg-background p-8 rounded-2xl border border-border hover:shadow-lg transition-all duration-300">
									<div className="bg-indigo-100 dark:bg-indigo-900/20 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
										<Icon className="size-6 text-indigo-600 dark:text-indigo-400" />
									</div>
									<h3 className="text-xl font-semibold mb-3">{prop.title}</h3>
									<p className="text-muted-foreground leading-relaxed">{prop.description}</p>
								</div>
							)
						})}
					</div>
				</div>
			</section>

			<section className="py-24 bg-muted/30">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center mb-16">
						<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Get started in minutes</h2>
						<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
							Connect Linear and start assigning issues to AI.
						</p>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
						{ONBOARDING_STEPS.map((step, index) => {
							const Icon = step.icon
							return (
								<div key={index} className="text-center">
									<div className="bg-indigo-100 dark:bg-indigo-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
										<Icon className="size-8 text-indigo-600 dark:text-indigo-400" />
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
													className="text-indigo-600 dark:text-indigo-400 hover:underline">
													{step.link.text} →
												</a>
											</>
										)}
									</p>
								</div>
							)
						})}
					</div>
				</div>
			</section>

			<section className="py-24">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mx-auto max-w-4xl rounded-3xl border border-border/50 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-blue-500/5 p-8 text-center shadow-2xl backdrop-blur-xl dark:border-white/10 sm:p-16">
						<h2 className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl">
							Start using Jabberwock in Linear
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
									Start free trial
									<ArrowRight className="ml-2 h-4 w-4" />
								</a>
							</Button>
						</div>
					</div>
				</div>
			</section>
		</>
	)
}
