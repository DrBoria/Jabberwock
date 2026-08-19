import type { ReactNode } from "react"

export type SlackMessage = {
	id: string
	author: string
	timeLabel: string
	body: ReactNode
	avatarText: string
	avatarClassName: string
	kind: "human" | "bot"
}

export type DemoPhase =
	| { kind: "show"; messageIndex: number }
	| { kind: "typing"; messageIndex: number }
	| { kind: "reset" }

export function FakeLink({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<span
			className={["text-violet-300 underline underline-offset-2 cursor-default", className]
				.filter(Boolean)
				.join(" ")}>
			{children}
		</span>
	)
}
