import { cn } from "@src/lib/utils"
import CodeBlock from "@src/features/foundation/components/code/CodeBlock"
import type { ArgumentsSectionProps } from "../types"

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
