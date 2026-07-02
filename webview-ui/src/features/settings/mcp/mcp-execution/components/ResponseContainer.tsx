import { memo } from "react"
import { cn } from "@src/lib/utils"
import CodeBlock from "@src/features/foundation/components/code/CodeBlock"
import { Markdown } from "@src/features/chat/task/messages/components/message-parts/markdown"
import type { ResponseContainerProps } from "../types"

const ResponseContainerInternal = ({
	isExpanded,
	response,
	isJson,
	hasArguments,
	isPartial = false,
}: ResponseContainerProps) => {
	if (!isExpanded || response.length === 0)
		return <div className={cn("overflow-hidden", { "max-h-0": !isExpanded })} />
	return (
		<div
			className={cn("overflow-hidden", {
				"max-h-96 overflow-y-auto mt-1 pt-1 border-t border-border/25": hasArguments,
				"max-h-96 overflow-y-auto mt-1 pt-1": !hasArguments,
			})}>
			{isJson ? (
				<CodeBlock source={response} language="json" />
			) : (
				<Markdown markdown={response} partial={isPartial} />
			)}
		</div>
	)
}

export const ResponseContainer = memo(ResponseContainerInternal)
