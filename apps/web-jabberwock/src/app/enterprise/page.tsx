import { CheckCircle, Code, ArrowRight } from "lucide-react"

import { AnimatedText } from "@/components/animated-text"
import { AnimatedBackground } from "@/components/homepage"
import { Button } from "@/components/ui"
import { enterpriseMetadata } from "./meta"
import { BENEFIT_CARDS, BenefitCard } from "./benefit-cards"
import { EnterpriseSecurity } from "./security"
import { EnterpriseCtaSection } from "./cta-section"
import { CURRENT_STATE_ISSUES, CONTROL_PLANE_BENEFITS } from "./data"

export const metadata = enterpriseMetadata

export default async function Enterprise() {
	return (
		<>
			<section className="relative flex h-[calc(100vh-theme(spacing.12))] items-center overflow-hidden">
				<AnimatedBackground />
				<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
					<div className="grid gap-8 md:gap-12 lg:grid-cols-2 lg:gap-16">
						<div className="flex flex-col justify-center space-y-6 sm:space-y-8">
							<div>
								<h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
									<span className="block">Jabberwock Cloud for</span>
									<AnimatedText className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
										Enterprise
									</AnimatedText>
								</h1>
								<p className="mt-4 max-w-md text-base text-muted-foreground sm:mt-6 sm:text-lg">
									The{" "}
									<AnimatedText className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
										control-plane
									</AnimatedText>{" "}
									for AI-powered software development. Gain visibility, governance, and control over
									your AI coding initiatives.
								</p>
							</div>
							<div className="flex flex-col space-y-3 sm:flex-row sm:space-x-4 sm:space-y-0">
								<Button
									size="lg"
									className="w-full bg-black text-white hover:bg-gray-800 hover:shadow-lg hover:shadow-black/20 dark:bg-white dark:text-black dark:hover:bg-gray-200 dark:hover:shadow-white/20 transition-all duration-300 sm:w-auto"
									asChild>
									<a href="#contact" className="flex w-full items-center justify-center">
										Request a Demo
										<ArrowRight className="ml-2 h-4 w-4" />
									</a>
								</Button>
								<Button
									variant="outline"
									size="lg"
									className="w-full sm:w-auto bg-white/20 dark:bg-white/10 backdrop-blur-sm border border-black/40 dark:border-white/30 hover:border-blue-400 hover:bg-white/30 dark:hover:bg-white/20 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all duration-300">
									<a href="#benefits" className="flex w-full items-center justify-center">
										Why Jabberwock
									</a>
								</Button>
							</div>
						</div>
						<div className="relative mt-8 flex items-center justify-center lg:mt-0">
							<div className="absolute inset-0 flex items-center justify-center">
								<div className="h-[250px] w-[250px] rounded-full bg-blue-500/20 blur-[100px] sm:h-[300px] sm:w-[300px] md:h-[350px] md:w-[350px]" />
							</div>
							<div className="relative z-10 rounded-lg border border-border bg-card p-6 shadow-lg">
								<div className="mb-4 flex items-center space-x-2">
									<Code className="h-6 w-6 text-blue-400" />
									<h3 className="text-lg font-semibold">Jabberwock Cloud Control-Plane</h3>
								</div>
								<p className="mb-4 text-sm text-muted-foreground">
									A unified control system for managing Jabberwock across your organization, with the
									flexibility to extend governance to your broader AI toolkit.
								</p>
								<div className="space-y-2">
									{[
										"Centralized Jabberwock management",
										"Real-time usage visibility",
										"Enterprise policy enforcement",
										"Extensible to other AI tools",
									].map((text) => (
										<div key={text} className="flex items-center space-x-2">
											<CheckCircle className="h-4 w-4 text-green-400" />
											<span className="text-sm">{text}</span>
										</div>
									))}
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			<section id="benefits" className="bg-secondary/50 py-16">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mb-12 text-center">
						<h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
							Take Control of Your AI Development
						</h2>
						<p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
							Jabberwock Cloud provides enterprise-grade control and visibility for Jabberwock
							deployments, with an extensible architecture for your evolving AI strategy.
						</p>
					</div>
					<div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
						{BENEFIT_CARDS.map((card) => (
							<BenefitCard key={card.title} card={card} />
						))}
					</div>
				</div>
			</section>

			<section className="py-16">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mb-12 text-center">
						<h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Why You Need a Control-Plane</h2>
						<p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
							See how Jabberwock Cloud brings enterprise control to AI-powered development.
						</p>
					</div>
					<div className="grid gap-8 md:grid-cols-2">
						<div className="rounded-lg border border-border bg-card p-8 shadow-sm">
							<h3 className="mb-4 text-2xl font-bold">Current State: AI Tool Sprawl</h3>
							<ul className="space-y-3">
								{CURRENT_STATE_ISSUES.map((issue) => (
									<li key={issue} className="flex items-start">
										<svg
											className="mr-2 mt-0.5 h-5 w-5 text-red-500"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M6 18L18 6M6 6l12 12"
											/>
										</svg>
										<span>{issue}</span>
									</li>
								))}
							</ul>
						</div>
						<div className="rounded-lg border border-border bg-card p-8 shadow-sm">
							<h3 className="mb-4 text-2xl font-bold text-blue-400">Jabberwock Cloud Control-Plane</h3>
							<ul className="space-y-3">
								{CONTROL_PLANE_BENEFITS.map((benefit) => (
									<li key={benefit} className="flex items-start">
										<CheckCircle className="mr-2 mt-0.5 h-5 w-5 text-green-500" />
										<span>{benefit}</span>
									</li>
								))}
							</ul>
						</div>
					</div>
				</div>
			</section>

			<EnterpriseSecurity />

			<EnterpriseCtaSection />
		</>
	)
}
