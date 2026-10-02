import { cn } from "@src/lib/utils"
import { CodeBlock } from "@src/features/foundation"
import type { ArgumentsSectionProps } from "@src/features/settings/mcp/mcp-execution/types"

export const ArgumentsSection = ({
	formattedArgumentsText,
	isArguments,
	isUseMcpTool,
	hasToolNameAndServer,
}: ArgumentsSectionProps) => (
	<div className={cn({ "mt-1 pt-1": !isArguments && (isUseMcpTool || hasToolNameAndServer) })}>
		<CodeBlock source={formattedArgumentsText} language="json" />
	</div>
)
