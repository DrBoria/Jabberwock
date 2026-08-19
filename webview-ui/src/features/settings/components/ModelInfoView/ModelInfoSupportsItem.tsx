import { cn } from "@src/lib/utils"

type ModelInfoSupportsItemProps = {
	isSupported: boolean
	supportsLabel: string
	doesNotSupportLabel: string
}

export const ModelInfoSupportsItem = ({
	isSupported,
	supportsLabel,
	doesNotSupportLabel,
}: ModelInfoSupportsItemProps) => (
	<div className="flex items-center gap-1 font-medium">
		<span className={cn("codicon", isSupported ? "codicon-check" : "codicon-x")} />
		{isSupported ? supportsLabel : doesNotSupportLabel}
	</div>
)
