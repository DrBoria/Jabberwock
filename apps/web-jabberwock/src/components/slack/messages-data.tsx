import type { ReactNode } from "react"
import { FakeLink } from "./thread-demo-data"
import { SLACK_MESSAGES_EXTRA } from "./messages-extra"

export type SlackMessage = {
	id: string
	author: string
	timeLabel: string
	body: ReactNode
	avatarText: string
	avatarClassName: string
	kind: "human" | "bot"
}

const CORE_MESSAGES: SlackMessage[] = [
	{
		id: "m1",
		author: "Avery Lee",
		timeLabel: "Monday at 2:56 PM",
		avatarText: "AL",
		avatarClassName: "bg-[#2B2D31] text-[#F8F8F9] ring-1 ring-white/10",
		kind: "human" as const,
		body: <span>We need to add a page to our Marketing site that highlights using Jabberwock from Slack.</span>,
	},
	{
		id: "m2",
		author: "Avery Lee",
		timeLabel: "Monday at 2:58 PM",
		avatarText: "AL",
		avatarClassName: "bg-[#2B2D31] text-[#F8F8F9] ring-1 ring-white/10",
		kind: "human" as const,
		body: (
			<div className="space-y-2">
				<div>
					The documentation for using Jabberwock from Slack is here:{" "}
					<FakeLink className="hover:text-violet-200">
						https://docs.jabberwock.com/jabberwock-cloud/slack-integration
					</FakeLink>
				</div>
				<div className="text-[#B8BBC0]">Here are some pages from our site we can use for guidance:</div>
				<ol className="list-decimal pl-5 text-[#D1D2D3]">
					<li>
						<FakeLink className="hover:text-violet-200">https://jabberwock.com</FakeLink>
					</li>
					<li>
						<FakeLink className="hover:text-violet-200">https://jabberwock.com/extension</FakeLink>
					</li>
					<li>
						<FakeLink className="hover:text-violet-200">https://jabberwock.com/cloud</FakeLink>
					</li>
				</ol>
			</div>
		),
	},
	{
		id: "m3",
		author: "Avery Lee",
		timeLabel: "Monday at 3:08 PM",
		avatarText: "AL",
		avatarClassName: "bg-[#2B2D31] text-[#F8F8F9] ring-1 ring-white/10",
		kind: "human" as const,
		body: (
			<div className="space-y-3">
				<div>This is the start of a wireframe I have in mind for this page</div>
				<div className="w-full max-w-[420px] rounded-lg border border-white/10 bg-black/20 p-3">
					<div className="flex items-center gap-2 text-[12px] text-[#B8BBC0]">
						<span className="h-4 w-4" />
						IMG_9721.heic
					</div>
					<div className="mt-3 h-24 w-full rounded-md bg-gradient-to-br from-white/10 via-white/5 to-white/0" />
				</div>
			</div>
		),
	},
	{
		id: "m4",
		author: "Avery Lee",
		timeLabel: "Monday at 3:09 PM",
		avatarText: "AL",
		avatarClassName: "bg-[#2B2D31] text-[#F8F8F9] ring-1 ring-white/10",
		kind: "human" as const,
		body: (
			<span>
				<FakeLink className="no-underline hover:text-violet-200">@Roomote</FakeLink> let&apos;s create the plan
				to deliver this
			</span>
		),
	},
	{
		id: "m5",
		author: "Roomote",
		timeLabel: "Monday at 3:09 PM",
		avatarText: "R",
		avatarClassName: "bg-violet-500/20 text-violet-200 ring-1 ring-violet-500/30",
		kind: "bot" as const,
		body: (
			<div className="space-y-3">
				<div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[#D1D2D3]">
					Calling <span className="font-semibold text-[#F8F8F9]">Planneroo</span> to get started on your task
					on{" "}
					<code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px] text-[#F8F8F9]">
						JabberwockInc/Jabberwock
					</code>
				</div>
				<div>
					<button
						type="button"
						className="inline-flex items-center rounded-md border border-white/10 bg-transparent px-2 py-1 text-[12px] font-medium text-[#D1D2D3] hover:bg-white/5">
						Cancel ✕
					</button>
				</div>
			</div>
		),
	},
]

export const SLACK_MESSAGES: SlackMessage[] = [...CORE_MESSAGES, ...SLACK_MESSAGES_EXTRA]
