import { cn } from "@src/lib/utils"
import { Container } from "@src/shared/ui/layouts/Container"
import type { StatusIndicatorProps } from "../types"

export const StatusIndicator = ({ status, t }: StatusIndicatorProps) => {
	if (!status) return null
	const isError = status.status === "error"
	const isCompleted = status.status === "completed"
	const showError = isError && "error" in status && !!status.error
	const dotColor = isError ? "bg-red-400" : "bg-lime-400"
	const textColor = isError ? "text-vscode-errorForeground" : "text-vscode-foreground"
	const label =
		status.status === "started"
			? t("execution.running")
			: isCompleted
				? t("execution.completed")
				: t("execution.error")
	return (
		<Container $preset="row" $gap="8px" className="font-mono text-xs">
			<div className={cn("rounded-full size-1.5", dotColor)} />
			<div className={cn("whitespace-nowrap", textColor)}>{label}</div>
			{showError && <div className="whitespace-nowrap">({status.error})</div>}
		</Container>
	)
}
