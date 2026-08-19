"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { CheckCircle2 } from "lucide-react"

import { cn } from "@/lib/utils"
import type { DemoPhase } from "./thread-demo-data"
import { SLACK_MESSAGES } from "./messages-data"
import type { SlackMessage } from "./messages-data"
import { usePrefersReducedMotion, TypingDots, SlackMessageRow } from "./demo-components"

export type SlackThreadDemoProps = { className?: string }

export function SlackThreadDemo({ className }: SlackThreadDemoProps): JSX.Element {
	const reduceMotion = usePrefersReducedMotion()
	const [stepIndex, setStepIndex] = useState(0)
	const scrollViewportRef = useRef<HTMLDivElement>(null)
	const messages: SlackMessage[] = useMemo(() => SLACK_MESSAGES, [])
	const phases: DemoPhase[] = useMemo(() => {
		const next: DemoPhase[] = []
		if (messages.length === 0) return [{ kind: "reset" }]
		next.push({ kind: "typing", messageIndex: 0 }, { kind: "show", messageIndex: 0 })
		for (let messageIndex = 1; messageIndex < messages.length; messageIndex += 1) {
			next.push({ kind: "typing", messageIndex }, { kind: "show", messageIndex })
		}
		next.push({ kind: "reset" })
		return next
	}, [messages])
	const lastShowPhaseIndex = useMemo(() => {
		let lastIndex = -1
		for (let idx = 0; idx < phases.length; idx += 1) {
			if (phases[idx]?.kind === "show") lastIndex = idx
		}
		return lastIndex
	}, [phases])

	useEffect(() => {
		if (reduceMotion) {
			setStepIndex(lastShowPhaseIndex >= 0 ? lastShowPhaseIndex : 0)
			return
		}
		const active = phases[stepIndex] ?? phases.at(0)
		const isLastMessageShow = active?.kind === "show" && stepIndex === lastShowPhaseIndex
		const durationMs = (() => {
			const base = 2200
			if (active?.kind === "reset") return 500
			if (active?.kind === "typing") return 900
			return isLastMessageShow ? base * 2 : base
		})()
		const timer = window.setTimeout(() => {
			setStepIndex((prev) => (prev + 1) % phases.length)
		}, durationMs)
		return () => window.clearTimeout(timer)
	}, [lastShowPhaseIndex, phases, reduceMotion, stepIndex])

	const activePhase = phases[stepIndex] ?? phases.at(0) ?? { kind: "reset" as const }

	function getVisibleCount(phase: DemoPhase): number {
		if (phase.kind === "reset") return 0
		if (phase.kind === "typing") return phase.messageIndex
		return phase.messageIndex + 1
	}

	const visibleCount = getVisibleCount(activePhase)
	const visibleMessages = messages.slice(0, visibleCount)
	const typingTarget = activePhase.kind === "typing" ? messages[activePhase.messageIndex] : undefined

	useEffect(() => {
		const viewport = scrollViewportRef.current
		if (!viewport) return
		if (activePhase.kind === "reset" || visibleCount <= 1) {
			viewport.scrollTo({ top: 0, behavior: "auto" })
			return
		}
		viewport.scrollTo({ top: viewport.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" })
	}, [activePhase.kind, reduceMotion, visibleCount])

	return (
		<div
			className={cn("w-full max-w-[620px] h-[520px] sm:h-[560px]", className)}
			role="img"
			aria-label="Animated Slack thread showing Jabberwock responding as @Roomote">
			<div
				aria-hidden="true"
				className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1A1D21] shadow-2xl shadow-black/30">
				<div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
					<div className="flex items-center gap-2">
						<div className="h-2.5 w-2.5 rounded-full bg-[#F24A4A]" />
						<div className="h-2.5 w-2.5 rounded-full bg-[#F2C94C]" />
						<div className="h-2.5 w-2.5 rounded-full bg-[#27AE60]" />
						<div className="ml-3 text-sm font-semibold text-[#F8F8F9]">Thread</div>
					</div>
					<div className="flex items-center gap-2 text-[11px] text-[#8B8D91]">
						<span className="h-2 w-2 rounded-full bg-[#27AE60]" />
						Live demo
					</div>
				</div>

				<div
					ref={scrollViewportRef}
					className="flex-1 overflow-y-auto px-4 py-5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent]">
					<div
						className={cn(
							"space-y-5 transition-opacity duration-300 will-change-opacity",
							activePhase.kind === "reset" ? "opacity-0" : "opacity-100",
						)}>
						{visibleMessages.map((message) => (
							<SlackMessageRow
								key={message.id}
								message={message}
								reduceMotion={reduceMotion}
								isNew={
									activePhase.kind === "show" && messages[activePhase.messageIndex]?.id === message.id
								}
							/>
						))}

						{typingTarget && (
							<div className={cn(reduceMotion ? "" : "animate-in fade-in duration-300", "flex gap-3")}>
								<div
									className={cn(
										"mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
										typingTarget.avatarClassName,
									)}>
									{typingTarget.avatarText}
								</div>
								<div className="min-w-0">
									<div className="flex items-baseline gap-x-2">
										<span className="text-[13px] font-semibold text-[#F8F8F9]">
											{typingTarget.author}
										</span>
										{typingTarget.kind === "bot" && (
											<span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-medium text-violet-200">
												<CheckCircle2 className="h-3 w-3" />
												App
											</span>
										)}
										<span className="text-[11px] text-[#8B8D91]">typing&hellip;</span>
									</div>
									<div className="mt-2">
										<TypingDots />
									</div>
								</div>
							</div>
						)}
					</div>
				</div>

				<div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
					<div className="flex items-center gap-1.5">
						{messages.map((message, idx) => (
							<span
								key={message.id}
								className={cn(
									"h-1.5 w-5 rounded-full transition-colors duration-300",
									Math.max(0, visibleCount - 1) === idx ? "bg-violet-300" : "bg-white/10",
								)}
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}
