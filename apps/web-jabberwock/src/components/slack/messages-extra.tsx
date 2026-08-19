import type { SlackMessage } from "./messages-data"
import { FakeLink } from "./thread-demo-data"

export const SLACK_MESSAGES_EXTRA: SlackMessage[] = [
	{
		id: "m6",
		author: "Roomote",
		timeLabel: "Monday at 3:10 PM",
		avatarText: "R",
		avatarClassName: "bg-violet-500/20 text-violet-200 ring-1 ring-violet-500/30",
		kind: "bot" as const,
		body: (
			<div className="space-x-2">
				<span>Cool, I&apos;ll knock this out real quick.</span>
				<FakeLink className="hover:text-violet-200">Follow along</FakeLink>
			</div>
		),
	},
	{
		id: "m7",
		author: "Roomote",
		timeLabel: "Monday at 3:12 PM",
		avatarText: "R",
		avatarClassName: "bg-violet-500/20 text-violet-200 ring-1 ring-violet-500/30",
		kind: "bot" as const,
		body: (
			<div className="space-y-2">
				<div className="font-semibold text-[#F8F8F9]">Todo List:</div>
				<div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
					<ul className="space-y-1">
						{[
							"Analyze existing page structures and component patterns",
							"Review marketing content requirements and wireframe details",
							"Create detailed component architecture plan",
							"Design page structure and section breakdown",
							"Plan navigation updates and integration points",
							"Test the page and verify all sections work",
						].map((item) => (
							<li key={item} className="text-[#D1D2D3]">
								<span className="mr-2">•</span>
								<span className="line-through opacity-80">{item}</span>
							</li>
						))}
					</ul>
				</div>
				<div className="text-[12px] text-[#8B8D91]">(edited)</div>
			</div>
		),
	},
	{
		id: "m8",
		author: "Roomote",
		timeLabel: "Monday at 3:16 PM",
		avatarText: "R",
		avatarClassName: "bg-violet-500/20 text-violet-200 ring-1 ring-violet-500/30",
		kind: "bot" as const,
		body: (
			<div className="space-y-3">
				<p>
					I&apos;ve created a comprehensive implementation plan for the Jabberwock Slack integration marketing
					page at{" "}
					<code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px] text-[#F8F8F9]">
						plans/slack-marketing-page-plan.md
					</code>
					.
				</p>
				<div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
					<div className="text-[12px] font-semibold text-[#F8F8F9]">Plan Overview</div>
					<ul className="mt-2 space-y-1 text-[#D1D2D3]">
						<li>
							<span className="mr-2">•</span>Hero + dual CTAs
						</li>
						<li>
							<span className="mr-2">•</span>Value props grid
						</li>
						<li>
							<span className="mr-2">•</span>&ldquo;Thread to Shipped Feature&rdquo; workflow
						</li>
						<li>
							<span className="mr-2">•</span>Onboarding steps + CTA
						</li>
					</ul>
				</div>
				<div className="space-x-2">
					<span className="text-[#B8BBC0]">Full document:</span>
					<FakeLink className="hover:text-violet-200">View artifact</FakeLink>
				</div>
				<div className="text-[12px] italic text-[#8B8D91]">
					Want to follow up? Just @-mention me in your response.
				</div>
			</div>
		),
	},
	{
		id: "m9",
		author: "Avery Lee",
		timeLabel: "Monday at 3:17 PM",
		avatarText: "AL",
		avatarClassName: "bg-[#2B2D31] text-[#F8F8F9] ring-1 ring-white/10",
		kind: "human" as const,
		body: (
			<div className="space-x-2">
				<FakeLink className="no-underline hover:text-violet-200">@Roomote</FakeLink>
				<span>this looks great, let&apos;s use Coderoo to build this</span>
			</div>
		),
	},
	{
		id: "m10",
		author: "Roomote",
		timeLabel: "Monday at 3:23 PM",
		avatarText: "R",
		avatarClassName: "bg-violet-500/20 text-violet-200 ring-1 ring-violet-500/30",
		kind: "bot" as const,
		body: (
			<div className="space-y-3">
				<p>
					I&apos;ve built the Jabberwock Slack integration marketing page. Here&apos;s what was implemented:
				</p>
				<div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
					<div className="text-[12px] font-semibold text-[#F8F8F9]">Files</div>
					<ul className="mt-2 space-y-1 text-[#D1D2D3]">
						<li>
							<span className="mr-2">•</span>
							<code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px] text-[#F8F8F9]">
								apps/web-jabberwock/src/app/slack/page.tsx
							</code>{" "}
							— Slack marketing page
						</li>
						<li>
							<span className="mr-2">•</span>
							<code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px] text-[#F8F8F9]">
								apps/web-jabberwock/src/lib/constants.ts
							</code>{" "}
							— added{" "}
							<code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px] text-[#F8F8F9]">
								SLACK_DOCS
							</code>
						</li>
						<li>
							<span className="mr-2">•</span>
							<code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px] text-[#F8F8F9]">
								apps/web-jabberwock/src/components/chromes/nav-bar.tsx
							</code>{" "}
							— added Slack to Product dropdown
						</li>
					</ul>
				</div>
				<div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
					<div className="text-[12px] font-semibold text-[#F8F8F9]">Pull Request</div>
					<div className="mt-2">
						<span className="font-semibold text-[#F8F8F9]">PR #10853</span>:{" "}
						<FakeLink className="hover:text-violet-200">
							https://github.com/JabberwockInc/Jabberwock/pull/10853
						</FakeLink>
					</div>
				</div>
				<p className="text-[#B8BBC0]">
					The page is accessible at{" "}
					<code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px] text-[#F8F8F9]">/slack</code> and
					includes navigation links in desktop and mobile.
				</p>
			</div>
		),
	},
]
