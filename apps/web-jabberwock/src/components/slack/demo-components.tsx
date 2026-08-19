"use client"

import { useEffect, useState } from "react"
import { CheckCircle2 } from "lucide-react"

import { cn } from "@/lib/utils"
import type { SlackMessage } from "./messages-data"

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
		<span className={cn("inline-flex items-center gap-1", className)} aria-hidden="true">
			<span className="h-1.5 w-1.5 rounded-full bg-[#8B8D91] animate-pulse [animation-delay:0ms]" />
			<span className="h-1.5 w-1.5 rounded-full bg-[#8B8D91] animate-pulse [animation-delay:180ms]" />
			<span className="h-1.5 w-1.5 rounded-full bg-[#8B8D91] animate-pulse [animation-delay:360ms]" />
		</span>
	)
}

type SlackMessageRowProps = { message: SlackMessage; isNew: boolean; reduceMotion: boolean }

export function SlackMessageRow({ message, isNew, reduceMotion }: SlackMessageRowProps): JSX.Element {
	const animation = !reduceMotion && isNew ? "animate-in fade-in slide-in-from-bottom-2 duration-500" : ""
	return (
		<div className={cn("flex gap-3", animation)}>
			<div
				className={cn(
					"mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
					message.avatarClassName,
				)}>
				{message.avatarText}
			</div>
			<div className="min-w-0">
				<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
					<span className="text-[13px] font-semibold text-[#F8F8F9]">{message.author}</span>
					<span className="text-[11px] text-[#8B8D91]">{message.timeLabel}</span>
					{message.kind === "bot" && (
						<span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-medium text-violet-200">
							<CheckCircle2 className="h-3 w-3" />
							App
						</span>
					)}
				</div>
				<div className="mt-1 text-[13px] leading-relaxed text-[#D1D2D3]">{message.body}</div>
			</div>
		</div>
	)
}
