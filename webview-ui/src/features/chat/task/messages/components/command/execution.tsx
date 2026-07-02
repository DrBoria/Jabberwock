import { useState, useMemo, useEffect } from "react"
import { observer } from "mobx-react-lite"
import { onSnapshot } from "mobx-state-tree"
import type { CommandExecutionStatus } from "@jabberwock/types"
import { parseCommand } from "@shared/misc/parse-command"
import { rootStore } from "@src/features/store"
import { extractPatternsFromCommand } from "@src/utils/parser/extractCommand"
import { commandExecutionStore } from "@src/features/chat/tree/store"
import { ExitStatusBadge, RunningStatusBar, ExpandButton } from "./CommandHeader"
import { CommandBody } from "./CommandBody"
import {
	parseCommandAndOutput,
	handleAllowPatternChange as onAllowChange,
	handleDenyPatternChange as onDenyChange,
} from "./commandExecution.utils"

export const CommandExecution = observer(
	({
		executionId,
		text,
		icon,
		title,
	}: {
		executionId: string
		text?: string
		icon?: JSX.Element | null
		title?: JSX.Element | null
	}) => {
		const terminalShellIntegrationDisabled = rootStore.extensionState.terminalShellIntegrationDisabled ?? false
		const allowedCommands = rootStore.extensionState.allowedCommands ?? []
		const deniedCommands = rootStore.extensionState.deniedCommands ?? []
		const { command, output: parsedOutput } = useMemo(() => parseCommandAndOutput(text), [text])
		const [isExpanded, setIsExpanded] = useState(terminalShellIntegrationDisabled)
		const [streamingOutput, setStreamingOutput] = useState("")
		const [status, setStatus] = useState<CommandExecutionStatus | null>(null)
		const [internalAllowed, setInternalAllowed] = useState<string[]>(allowedCommands)
		const [internalDenied, setInternalDenied] = useState<string[]>(deniedCommands)
		const output = streamingOutput || parsedOutput

		const commandPatterns = useMemo<{ pattern: string; description?: string }[]>(() => {
			const allCommands = parseCommand(command)
			const allPatterns = new Set<string>()
			allCommands.forEach((cmd) => {
				if (cmd.trim()) allPatterns.add(cmd.trim())
			})
			allCommands.forEach((cmd) => {
				const patterns = extractPatternsFromCommand(cmd)
				patterns.forEach((pattern) => allPatterns.add(pattern))
			})
			return Array.from(allPatterns).map((pattern) => ({ pattern }))
		}, [command])

		const handleAllow = (pattern: string) =>
			onAllowChange(pattern, internalAllowed, internalDenied, setInternalAllowed, setInternalDenied, (s) =>
				rootStore.settings.updateSettings(s),
			)

		const handleDeny = (pattern: string) =>
			onDenyChange(pattern, internalAllowed, internalDenied, setInternalAllowed, setInternalDenied, (s) =>
				rootStore.settings.updateSettings(s),
			)

		useEffect(() => {
			const disposer = onSnapshot(commandExecutionStore, (snapshot) => {
				const execution = snapshot.executions.find(
					(e: Record<string, unknown>) => e.executionId === executionId,
				)
				if (!execution) return
				switch (execution.status) {
					case "started":
						setStatus(execution as CommandExecutionStatus)
						break
					case "output":
						setStreamingOutput(execution.output as string)
						break
					case "fallback":
						setIsExpanded(true)
						break
					default:
						setStatus(execution as CommandExecutionStatus)
						break
				}
			})
			return disposer
		}, [executionId])

		return (
			<>
				<div className="flex flex-row items-center justify-between gap-2 mb-1">
					<div className="flex flex-row items-center gap-2">
						{icon}
						{title}
						<ExitStatusBadge status={status} />
					</div>
					<div className="flex flex-row items-center justify-between gap-2 px-1">
						<div className="flex flex-row items-center gap-1">
							<RunningStatusBar status={status} />
							<ExpandButton
								isExpanded={isExpanded}
								output={output}
								onToggle={() => setIsExpanded(!isExpanded)}
							/>
						</div>
					</div>
				</div>
				<CommandBody
					command={command}
					commandPatterns={commandPatterns}
					allowedCommands={internalAllowed}
					deniedCommands={internalDenied}
					isExpanded={isExpanded}
					output={output}
					handleAllowPatternChange={handleAllow}
					handleDenyPatternChange={handleDeny}
				/>
			</>
		)
	},
)

CommandExecution.displayName = "CommandExecution"
