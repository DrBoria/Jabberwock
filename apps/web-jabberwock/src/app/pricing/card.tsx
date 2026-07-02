import { ArrowRight, Check, CornerRightDown } from "lucide-react"
import Link from "next/link"

import type { PricingTier } from "./data"

import { Button } from "@/components/ui"

export function PricingTierCard({ tier }: { tier: PricingTier }) {
	const Icon = tier.icon
	return (
		<div className="relative group p-6 flex flex-col justify-start bg-background rounded-2xl outline outline-2 outline-border/50 hover:outline-8 transition-all shadow-xl hover:shadow-2xl hover:outline-6">
			<div className="mb-6">
				<div className="flex items-center justify-between">
					<h3 className="text-2xl font-bold tracking-tight">{tier.name}</h3>
				</div>
				<p className="text-sm font-medium">{tier.description}</p>
			</div>
			<div className="absolute -right-2 -top-4 rounded-full bg-card shadow-md p-4 outline outline-2 outline-border/50 group-hover:scale-105 group-hover:outline-8 transition-all">
				<Icon className="size-6" strokeWidth={1.5} />
			</div>
			<div className="grow mb-8 md:h-[214px]">
				<p className="text-sm text-muted-foreground font-light mb-2">{tier.featuresIntro}&nbsp;</p>
				<ul className="space-y-3 my-0">
					{tier.features.map((feature) => (
						<li key={feature} className="flex items-start gap-2">
							<Check className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
							<span className="text-sm">{feature}</span>
						</li>
					))}
				</ul>
				{tier.learnMoreLink && (
					<div className="mt-2">
						<Link
							href={tier.learnMoreLink}
							className="text-sm text-violet-600 dark:text-violet-400 hover:underline">
							Learn more &rarr;
						</Link>
					</div>
				)}
			</div>
			<p className="text-base font-light">{tier.trial}</p>
			<p className="text-xl mb-1 tracking-tight font-light">
				<strong className="font-bold">{tier.price}</strong>
				{tier.period} + {tier.priceSuffix}
				<CornerRightDown className="inline size-4 ml-1 relative top-0.5" />
			</p>
			<p className="text-sm text-muted-foreground mb-5">
				{tier.creditPrice && (
					<>
						Cloud Agents: {tier.creditPrice}/hour in credits
						<br />
					</>
				)}
				Inference:{" "}
				<Link href="/provider" className="underline hover:no-underline">
					Jabberwock Provider pricing
				</Link>{" "}
				credits or{" "}
				<abbr title="Bring Your Own Model" className="cursor-help">
					BYOM
				</abbr>
			</p>
			<Button size="lg" className="w-full transition-all duration-300" asChild>
				<Link href={tier.cta.href!} className="flex items-center justify-center">
					{tier.cta.text}
					<ArrowRight />
				</Link>
			</Button>
			<div className="h-[28px] absolute bottom-[-31px] left-1/2 w-[4px] transition-colors bg-gradient-to-b from-transparent to-violet-700/20 group-hover:from-violet-500/50 group-hover:to-violet-500/20" />
		</div>
	)
}
