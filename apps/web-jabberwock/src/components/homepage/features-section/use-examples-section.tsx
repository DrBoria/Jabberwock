"use client"

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CornerDownRight, ChevronDown } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui"
import type { UseCase } from "../data/use-examples-data"
import { USE_CASES } from "../data/use-examples-data"

interface PositionedUseCase extends UseCase {
	layer: 1 | 2 | 3 | 4
	position: { x: number; y: number }
	scale: number
	zIndex: number
	avatar: string
	width: number
}

// Seeded random number generator for consistent layout
function seededRandom(seed: number) {
	let value = seed
	return () => {
		value = (value * 9301 + 49297) % 233280
		return value / 233280
	}
}

const LAYER_SCALES = {
	1: 0.7,
	2: 0.85,
	3: 1.0,
	4: 1.15,
}

function distributeItems(items: UseCase[]): PositionedUseCase[] {
	const rng = seededRandom(42)
	const zones = { rows: 7, cols: 4 }
	const zoneWidth = 100 / zones.cols
	const zoneHeight = 100 / zones.rows

	// Create array of zone indices [0...19] and shuffle them
	const zoneIndices = Array.from({ length: items.length }, (_, i) => i)
	for (let i = zoneIndices.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1))
		const temp = zoneIndices[i]!
		zoneIndices[i] = zoneIndices[j]!
		zoneIndices[j] = temp
	}

	return items.map((item, index) => {
		const zoneIndex = zoneIndices[index]!
		const row = Math.floor(zoneIndex / zones.cols)
		const col = zoneIndex % zones.cols

		const layer = ((index % 4) + 1) as 1 | 2 | 3 | 4

		const baseX = col * zoneWidth + zoneWidth / 2
		const baseY = row * zoneHeight + zoneHeight / 2

		const jitterX = (rng() - 0.5) * zoneWidth * 0.7
		const jitterY = (rng() - 0.5) * zoneHeight * 0.7

		return {
			...item,
			avatar: `/illustrations/user-faces/${index + 1}.jpg`,
			layer,
			position: {
				x: baseX + jitterX,
				y: baseY + jitterY,
			},
			scale: LAYER_SCALES[layer],
			zIndex: layer,
			width: Math.round(300 + rng() * 100),
		}
	})
}

function UseCaseCardContent({
	item,
	opacity = 1,
	className = "",
}: {
	item: UseCase & { avatar: string }
	opacity?: number
	className?: string
}) {
	const ContextIcon: LucideIcon = item.context.icon
	return (
		<div
			className={`rounded-xl outline outline-border/50 bg-card/80 backdrop-blur-sm p-3 md:p-4 shadow-xl transition-all hover:shadow-xl hover:outline-8 ${className}`}>
			<div
				className="text-sm flex items-center gap-2 font-medium text-violet-600 mb-1"
				style={{ opacity: opacity }}>
				<Image
					src={item.avatar}
					className="size-6 rounded-full outline-1 outline-border"
					alt=""
					width={18}
					height={18}
					unoptimized
				/>
				<span className="text-nowrap">{item.role}</span>
			</div>

			<div
				className="text-[0.7em] flex flex-wrap items-center gap-1 text-muted-foreground mb-1"
				style={{ opacity: opacity }}>
				<CornerDownRight className="size-4 shrink-0 ml-3 -mt-1" />
				<span className="text-nowrap font-mono">To {item.agent.name} Agent</span>
			</div>

			<div className="text-base font-light leading-tight my-1 ml-8" style={{ opacity: opacity }}>
				{item.use}
			</div>

			<div
				className="text-[0.7em] font-light text-muted-foreground leading-tight mt-2 ml-8"
				style={{ opacity: opacity }}>
				via <ContextIcon strokeWidth={1.5} className="size-3.5 inline ml-1" /> {item.context.name}
			</div>
		</div>
	)
}

function DesktopUseCaseCard({ item }: { item: PositionedUseCase }) {
	const opacity = Math.min(1, 0.5 + item.layer / 3)

	return (
		<motion.div
			className="absolute w-[200px] cursor-default group"
			style={{
				left: `${item.position.x}%`,
				top: `${item.position.y}%`,
				zIndex: item.zIndex,
				width: item.width,
			}}
			initial={{ opacity: 0, scale: 0 }}
			whileInView={{
				opacity: 1,
				scale: item.scale,
				transition: {
					duration: 0.1,
					delay: 0,
				},
			}}
			whileHover={{
				scale: 1.3,
				zIndex: 30,
			}}
			viewport={{ once: true }}
			transformTemplate={({ scale }) => `translate(-50%, -50%) scale(${scale})`}>
			<UseCaseCardContent
				item={item}
				opacity={opacity}
				className={item.layer === 4 ? "shadow-lg border-border" : ""}
			/>
		</motion.div>
	)
}

export function UseExamplesSection({ agentTitle = false }: { agentTitle?: boolean }) {
	const positionedItems = useMemo(() => distributeItems(USE_CASES), [])
	const [showAllMobile, setShowAllMobile] = useState(false)

	return (
		<section className="pt-24 bg-background overflow-hidden relative">
			<div className="absolute inset-y-0 left-1/2 h-full w-full max-w-[1200px] -translate-x-1/2">
				<div className="absolute left-1/2 top-1/2 h-[700px] w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/10 blur-[140px]" />
			</div>
			<div className="container px-4 mx-auto sm:px-6 lg:px-8">
				<div className="text-center mb-16">
					<h2 className="text-4xl font-bold tracking-tight mb-4">
						{agentTitle ? (
							<>
								Part of the AI team to help your <em>entire</em> human team
							</>
						) : (
							<>
								The AI team to help your <em>entire</em> human team
							</>
						)}
					</h2>
					<p className="text-xl font-light text-muted-foreground max-w-2xl mx-auto">
						Developers, PMs, Designers, Customer Success: everyone moves faster and more independently with
						Jabberwock.
					</p>
				</div>

				<div className="md:hidden flex flex-col gap-2 px-2 pb-12 max-w-md mx-auto">
					<AnimatePresence mode="popLayout">
						{positionedItems.slice(0, showAllMobile ? undefined : 8).map((item, index) => (
							<motion.div
								key={item.use}
								initial={{ opacity: 0, y: 20 }}
								whileInView={{ opacity: 1, y: 0 }}
								transition={{ delay: (index % 8) * 0.1, duration: 0.4 }}
								viewport={{ once: true, margin: "-50px" }}
								className={`w-[90%] ${index % 2 === 0 ? "self-start" : "self-end"}`}>
								<UseCaseCardContent item={item} />
							</motion.div>
						))}
					</AnimatePresence>

					{!showAllMobile && (
						<div className="text-center mt-8 z-10">
							<Button variant="outline" onClick={() => setShowAllMobile(true)}>
								More
								<ChevronDown />
							</Button>
						</div>
					)}
				</div>

				<div className="hidden md:block relative h-[800px] md:min-h-[800px] w-full max-w-6xl mx-auto">
					{positionedItems.map((item, index) => (
						<DesktopUseCaseCard key={index} item={item} />
					))}
				</div>
			</div>
		</section>
	)
}
