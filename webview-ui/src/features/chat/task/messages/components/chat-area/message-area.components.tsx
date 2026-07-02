import React from "react"
import { CheckpointWarning } from "@src/features/chat/task/notifications/checkpoint/warning"
import { useStreamingStore } from "@src/features/api/streaming"
import { Markdown } from "../message-parts/markdown"

export const CheckpointWarningBanner = React.memo(function CheckpointWarningBanner({
	warning,
}: {
	warning: { type: "WAIT_TIMEOUT" | "INIT_TIMEOUT"; timeout: number } | undefined
}) {
	return warning ? (
		<div className="px-3">
			<CheckpointWarning warning={warning} />
		</div>
	) : null
})

export const StreamingFooter = React.memo(function StreamingFooter() {
	const { isActive, text } = useStreamingStore()
	return isActive && text ? (
		<div className="px-[15px] py-[10px]">
			<Markdown markdown={text} partial={true} />
		</div>
	) : null
})
