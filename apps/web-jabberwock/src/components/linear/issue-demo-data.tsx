import type { ReactNode } from "react"
import { GitPullRequest } from "lucide-react"

export type ActivityItem = {
	id: string
	kind: "comment" | "event" | "pr-link"
	author?: string
	avatarText?: string
	avatarClassName?: string
	body: ReactNode
	timeLabel: string
}

export type DemoPhase =
	| { kind: "issue" }
	| { kind: "show"; activityIndex: number }
	| { kind: "typing"; activityIndex: number }
	| { kind: "reset" }

export const ACTIVITY_ITEMS: ActivityItem[] = [
	{
		id: "a1",
		kind: "comment",
		author: "Jordan",
		avatarText: "J",
		avatarClassName: "bg-amber-600 text-white",
		body: (
			<span>
				<span className="text-indigo-400">@Jabberwock</span> Can you implement this feature?
			</span>
		),
		timeLabel: "2m ago",
	},
	{
		id: "a2",
		kind: "comment",
		author: "Jabberwock",
		avatarText: "R",
		avatarClassName: "bg-indigo-600 text-white",
		body: <span>Analyzing issue requirements and codebase...</span>,
		timeLabel: "2m ago",
	},
	{
		id: "a3",
		kind: "event",
		author: "Jabberwock",
		avatarText: "R",
		avatarClassName: "bg-indigo-600 text-white",
		body: <span>moved to In Progress</span>,
		timeLabel: "2m ago",
	},
	{
		id: "a4",
		kind: "comment",
		author: "Jabberwock",
		avatarText: "R",
		avatarClassName: "bg-indigo-600 text-white",
		body: <span>Planning implementation: Settings component with light/dark toggle.</span>,
		timeLabel: "1m ago",
	},
	{
		id: "a5",
		kind: "comment",
		author: "Jordan",
		avatarText: "J",
		avatarClassName: "bg-amber-600 text-white",
		body: (
			<span>
				<span className="text-indigo-400">@Jabberwock</span> Please also add a &quot;system&quot; option that
				follows OS preference.
			</span>
		),
		timeLabel: "1m ago",
	},
	{
		id: "a6",
		kind: "comment",
		author: "Jabberwock",
		avatarText: "R",
		avatarClassName: "bg-indigo-600 text-white",
		body: (
			<span>
				Got it! Adding system preference detection using{" "}
				<code className="rounded bg-white/10 px-1 py-0.5 text-[12px] text-[#F8F8F9]">prefers-color-scheme</code>
			</span>
		),
		timeLabel: "30s ago",
	},
	{
		id: "a7",
		kind: "pr-link",
		body: (
			<span>
				<span className="text-[#F8F8F9]">Jabberwock</span> linked{" "}
				<span className="text-emerald-400">PR #847</span>
			</span>
		),
		timeLabel: "just now",
	},
	{
		id: "a8",
		kind: "comment",
		author: "Jabberwock",
		avatarText: "R",
		avatarClassName: "bg-indigo-600 text-white",
		body: (
			<div className="space-y-2">
				<div>
					PR ready for review: <span className="text-indigo-400 hover:underline cursor-default">#847</span>
				</div>
				<div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px]">
					<div className="flex items-center gap-2 text-emerald-400">
						<GitPullRequest className="h-3.5 w-3.5" />
						<span className="font-medium">feat: add theme toggle with system preference</span>
					</div>
					<div className="mt-1 text-[#8B8D91]">+142 -12 · 3 files changed</div>
				</div>
			</div>
		),
		timeLabel: "just now",
	},
]
