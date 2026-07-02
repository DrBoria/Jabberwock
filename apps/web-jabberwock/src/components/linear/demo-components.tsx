"use client"

import { useEffect, useState } from "react"
import { GitPullRequest } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ActivityItem } from "./issue-demo-data"

export function usePrefersReducedMotion(): boolean {
	const [reduced, setReduced] = useState(false)

	useEffect(() => {
		const media = window.matchMedia("(prefers-reduced-motion: reduce)")
		const onChange = () => setReduced(media.matches)
		onChange()

		if (typeof media.addEventListener === "function") {
			media.addEventListener("change", onChange)
			return () => media.removeEventListener("change", onChange)
		}

		media.addListener?.(onChange)
		return () => media.removeListener?.(onChange)
	}, [])

	return reduced
}

export function TypingDots({ className }: { className?: string }): JSX.Element {
	return (
		<span className={cn("inline-flex items-center gap-0.5", className)} aria-hidden="true">
			<span className="h-1 w-1 rounded-full bg-[#8B8D91] animate-pulse [animation-delay:0ms]" />
			<span className="h-1 w-1 rounded-full bg-[#8B8D91] animate-pulse [animation-delay:180ms]" />
			<span className="h-1 w-1 rounded-full bg-[#8B8D91] animate-pulse [animation-delay:360ms]" />
		</span>
	)
}

type ActivityRowProps = { item: ActivityItem; isNew: boolean; reduceMotion: boolean }

export function ActivityRow({ item, isNew, reduceMotion }: ActivityRowProps): JSX.Element {
	const animClass = !reduceMotion && isNew ? "animate-in fade-in slide-in-from-bottom-1 duration-300" : ""

	if (item.kind === "event") {
		return (
			<div className={cn("flex items-center gap-2 text-[13px] text-[#8B8D91]", animClass)}>
				<div
					className={cn(
						"flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold",
						item.avatarClassName,
					)}>
					{item.avatarText}
				</div>
				<span className="text-[#F8F8F9]">{item.author}</span>
				<span>{item.body}</span>
				<span className="text-[#5C5F66]">·</span>
				<span>{item.timeLabel}</span>
			</div>
		)
	}

	if (item.kind === "pr-link") {
		return (
			<div className={cn("flex items-center gap-2 text-[13px] text-[#8B8D91]", animClass)}>
				<GitPullRequest className="h-4 w-4 shrink-0 text-emerald-500" />
				<span>{item.body}</span>
				<span className="text-[#5C5F66]">·</span>
				<span>{item.timeLabel}</span>
			</div>
		)
	}

	return (
		<div className={cn("flex gap-2.5", animClass)}>
			<div
				className={cn(
					"mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold",
					item.avatarClassName,
				)}>
				{item.avatarText}
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2 text-[13px]">
					<span className="font-medium text-[#F8F8F9]">{item.author}</span>
					<span className="text-[#5C5F66]">·</span>
					<span className="text-[#8B8D91]">{item.timeLabel}</span>
				</div>
				<div className="mt-1 text-[13px] leading-relaxed text-[#D1D2D3]">{item.body}</div>
			</div>
		</div>
	)
}
