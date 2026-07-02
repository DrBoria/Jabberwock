import { memo } from "react"
import { cn } from "@src/lib/utils"
import { TerminalOutput } from "../message-parts/terminal-output"

const OutputContainerInternal = ({ isExpanded, output }: { isExpanded: boolean; output: string }) => (
	<div
		className={cn("overflow-hidden", {
			"max-h-0": !isExpanded,
			"max-h-[100%] mt-1 pt-1 border-t border-border/25": isExpanded,
		})}>
		{output.length > 0 && <TerminalOutput content={output} />}
	</div>
)

export const OutputContainer = memo(OutputContainerInternal)
