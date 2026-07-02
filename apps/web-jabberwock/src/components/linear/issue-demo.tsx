"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronRight, Paperclip, Send } from "lucide-react"

import { cn } from "@/lib/utils"
import type { DemoPhase } from "./issue-demo-data"
import { ACTIVITY_ITEMS } from "./issue-demo-data"
import { usePrefersReducedMotion, TypingDots, ActivityRow } from "./demo-components"
import { LinearIcon } from "./icon"

const DURATION_MS: Record<string, number> = { reset: 500, issue: 1500, typing: 800 }

export type LinearIssueDemoProps = { className?: string }

export function LinearIssueDemo({ className }: LinearIssueDemoProps): JSX.Element {
	const reduceMotion = usePrefersReducedMotion()
	const [stepIndex, setStepIndex] = useState(0)
	const scrollViewportRef = useRef<HTMLDivElement>(null)

	const activityItems = useMemo(() => ACTIVITY_ITEMS, [])

	const phases: DemoPhase[] = useMemo(() => {
		const next: DemoPhase[] = [{ kind: "issue" }]
		for (let activityIndex = 0; activityIndex < activityItems.length; activityIndex += 1) {
			const item = activityItems[activityIndex]
			if (item?.kind === "comment") next.push({ kind: "typing", activityIndex })
			next.push({ kind: "show", activityIndex })
		}
		next.push({ kind: "reset" })
		return next
	}, [activityItems])

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
		const kind = active?.kind ?? ""
		const durationMs = kind in DURATION_MS ? DURATION_MS[kind] : isLastMessageShow ? 5000 : 2000

		const timer = window.setTimeout(() => {
			setStepIndex((stepIndex + 1) % phases.length)
		}, durationMs)

		return () => window.clearTimeout(timer)
	}, [lastShowPhaseIndex, phases, reduceMotion, stepIndex])

	const activePhase = phases[stepIndex] ?? phases.at(0) ?? { kind: "issue" as const }

	function getVisibleCount(phase: DemoPhase): number {
		if (phase.kind === "reset" || phase.kind === "issue") return 0
		if (phase.kind === "typing") return phase.activityIndex
		return phase.activityIndex + 1
	}

	const visibleCount = getVisibleCount(activePhase)
	const visibleActivities = activityItems.slice(0, visibleCount)
	const typingTarget = activePhase.kind === "typing" ? activityItems[activePhase.activityIndex] : undefined

	useEffect(() => {
		const viewport = scrollViewportRef.current
		if (!viewport) return

		if (activePhase.kind === "reset" || activePhase.kind === "issue" || visibleCount <= 1) {
			viewport.scrollTo({ top: 0, behavior: "auto" })
			return
		}

		viewport.scrollTo({ top: viewport.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" })
	}, [activePhase.kind, reduceMotion, visibleCount])

	const issueVisible = activePhase.kind !== "reset"

	return (
		<div
			className={cn("w-full max-w-[540px] h-[520px] sm:h-[560px]", className)}
			role="img"
			aria-label="Animated Linear issue showing Jabberwock responding to a comment">
			<div
				aria-hidden="true"
				className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1F2023] shadow-2xl shadow-black/40">
				<div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5 text-[13px]">
					<LinearIcon className="h-4 w-4 text-[#8B8D91]" />
					<span className="text-[#8B8D91]">Frontend</span>
					<ChevronRight className="h-3 w-3 text-[#5C5F66]" />
					<span className="text-[#F8F8F9]">FE-312</span>
					<div className="ml-auto flex items-center gap-2 text-[11px] text-[#8B8D91]">
						<span className="h-2 w-2 rounded-full bg-[#27AE60]" />
						Live demo
					</div>
				</div>

				<div
					className={cn(
						"flex flex-col flex-1 overflow-hidden transition-opacity duration-300 will-change-opacity",
						issueVisible ? "opacity-100" : "opacity-0",
					)}>
					<div className="px-4 pt-4 pb-3">
						<h3 className="text-lg font-semibold text-[#F8F8F9] leading-tight">
							Add dark mode toggle to settings
						</h3>
						<p className="mt-2 text-[13px] text-[#8B8D91] leading-relaxed">
							Users should be able to switch between light and dark themes from the settings page. Persist
							preference to localStorage and apply immediately.
						</p>
					</div>

					<div className="flex-1 overflow-hidden flex flex-col border-t border-white/10">
						<div className="px-4 py-2.5 flex items-center justify-between">
							<span className="text-[13px] font-medium text-[#F8F8F9]">Activity</span>
							<span className="text-[12px] text-[#5C5F66]">Unsubscribe</span>
						</div>
						<div
							ref={scrollViewportRef}
							className="flex-1 overflow-y-auto px-4 pb-3 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.1)_transparent]">
							<div className="space-y-3">
								{visibleActivities.map((item) => (
									<ActivityRow
										key={item.id}
										item={item}
										reduceMotion={reduceMotion}
										isNew={
											activePhase.kind === "show" &&
											activityItems[activePhase.activityIndex]?.id === item.id
										}
									/>
								))}

								{typingTarget && typingTarget.kind === "comment" && (
									<div
										className={cn(
											reduceMotion ? "" : "animate-in fade-in duration-300",
											"flex gap-2.5",
										)}>
										<div
											className={cn(
												"mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold",
												typingTarget.avatarClassName,
											)}>
											{typingTarget.avatarText}
										</div>
										<div className="min-w-0">
											<div className="flex items-center gap-2 text-[13px]">
												<span className="font-medium text-[#F8F8F9]">
													{typingTarget.author}
												</span>
												<span className="text-[#8B8D91]">typing</span>
												<TypingDots />
											</div>
										</div>
									</div>
								)}
							</div>
						</div>
					</div>

					<div className="border-t border-white/10 px-4 py-3">
						<div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
							<span className="flex-1 text-[13px] text-[#5C5F66]">Leave a comment...</span>
							<Paperclip className="h-4 w-4 text-[#5C5F66]" />
							<Send className="h-4 w-4 text-[#5C5F66]" />
						</div>
					</div>
				</div>

				<div className="flex items-center justify-center border-t border-white/10 px-4 py-2">
					<div className="flex items-center gap-1">
						{activityItems.map((item, idx) => (
							<span
								key={item.id}
								className={cn(
									"h-1 w-3 rounded-full transition-colors duration-300",
									Math.max(0, visibleCount - 1) === idx ? "bg-indigo-400" : "bg-white/10",
								)}
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}
