import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui"
import { AnimatedBackground } from "@/components/homepage"
import { EXTERNAL_LINKS } from "@/lib/constants"
import { pricingTiers } from "./data"
import { PricingTierCard } from "./card"
import { pricingMetadata } from "./meta"
import { FAQ_ITEMS } from "./faq"

export const metadata = pricingMetadata

export default function PricingPage() {
	return (
		<>
			<AnimatedBackground />
			<section className="relative overflow-hidden pt-12 pb-10">
				<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center">
						<h1 className="text-5xl font-bold tracking-tight">Jabberwock Pricing</h1>
						<p className="mt-4 text-lg text-muted-foreground">
							For all of our products: the Jabberwock VS Code Extension, Jabberwock Cloud and the
							Jabberwock Router.
						</p>
					</div>
				</div>
			</section>

			<section className="">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3 md:px-4">
						{pricingTiers.map((tier) => (
							<PricingTierCard key={tier.name} tier={tier} />
						))}
					</div>

					<div className="max-w-6xl mx-auto mt-8 p-7 flex flex-col md:flex-row gap-8 md:gap-4 bg-violet-200/20 outline-violet-700/20 outline outline-1 rounded-2xl transition-all shadow-none">
						<div className="md:border-r md:pr-4">
							<h3 className="text-lg font-medium mb-1">Jabberwock Router</h3>
							<div className="text-sm text-muted-foreground">
								<p className="">
									On any plan, you can use your own LLM provider API key or use the built-in
									Jabberwock Router &ndash; curated models to work with Jabberwock with no markup,
									including the latest Gemini, GPT and Claude. Paid with credits.
									<Link href="/provider" className="underline hover:no-underline ml-1">
										See per model pricing.
									</Link>
								</p>
							</div>
						</div>
						<div className="">
							<h3 className="text-lg font-medium mb-1">Credits</h3>
							<p className="text-sm text-muted-foreground">
								Credits are pre-paid, in dollars, and are deducted with usage for inference and Cloud
								Agent runs. You&apos;re always in control of your spend, no surprises.
							</p>
						</div>
					</div>
				</div>
			</section>

			<section className="bg-background py-16 my-16 border-t border-b relative z-50">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mx-auto max-w-3xl text-center">
						<h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Frequently Asked Questions</h2>
					</div>
					<div className="mx-auto mt-12 grid max-w-5xl gap-8 md:grid-cols-2">
						{FAQ_ITEMS.map((item) => (
							<div
								key={item.q}
								className={`rounded-xl border border-border bg-card p-6 ${item.q.includes("enterprise") ? "md:col-span-2" : ""}`}>
								<h3 className="font-semibold">{item.q}</h3>
								{item.a && <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>}
								{item.q === "How do credits work?" && (
									<>
										<p className="mt-2 text-sm text-muted-foreground">
											Jabberwock Cloud credits can be used in two ways:
										</p>
										<ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
											<li>To pay for Cloud Agents running time ($5/hour)</li>
											<li>
												To pay for AI model inference costs (
												<a
													href="/provider"
													target="_blank"
													rel="noopener noreferrer"
													className="underline">
													varies by model
												</a>
												)
											</li>
										</ul>
										<p className="mt-2 text-sm text-muted-foreground">
											To cover our infrastructure costs, we charge $5/hour while the agent is
											running (independent of inference costs).
										</p>
										<p className="mt-2 text-sm text-muted-foreground">
											There are no markups, no tiers, no dumbing-down of models to increase our
											profit.
										</p>
									</>
								)}
								{item.q.includes("enterprise") && (
									<p className="mt-2 text-sm text-muted-foreground">
										We have an Enterprise plan which can be a fit. Please{" "}
										<Link href="/enterprise#contact" className="underline hover:no-underline">
											reach out to our sales team
										</Link>{" "}
										to discuss it.
									</p>
								)}
							</div>
						))}
					</div>
					<div className="mt-12 text-center">
						<p className="text-muted-foreground">
							Still have questions?{" "}
							<a
								href={EXTERNAL_LINKS.DISCORD}
								target="_blank"
								rel="noopener noreferrer"
								className="font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300">
								Join our Discord
							</a>{" "}
							or{" "}
							<Link
								href="/enterprise#contact"
								className="font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300">
								contact our sales team
							</Link>
						</p>
					</div>
				</div>
			</section>

			<section className="py-20">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mx-auto max-w-4xl rounded-3xl border border-border/50 bg-gradient-to-br from-blue-500/5 via-cyan-500/5 to-purple-500/5 p-8 text-center shadow-2xl backdrop-blur-xl dark:border-white/20 dark:bg-gradient-to-br dark:from-gray-800 dark:via-gray-900 dark:to-black sm:p-12">
						<h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">Try Jabberwock Cloud now</h2>
						<p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">Code from anywhere.</p>
						<div className="flex flex-col justify-center space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
							<Button
								size="lg"
								className="bg-black text-white hover:bg-gray-800 hover:shadow-lg hover:shadow-black/20 dark:bg-white dark:text-black dark:hover:bg-gray-200 dark:hover:shadow-white/20 transition-all duration-300"
								asChild>
								<a
									href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP}
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center justify-center">
									Create a free Cloud account
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
