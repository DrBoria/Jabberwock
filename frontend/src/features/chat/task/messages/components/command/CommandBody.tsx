import CodeBlock from "@src/features/foundation/components/code/CodeBlock"
import { CommandPatternSelector } from "./pattern-selector"
import { OutputContainer } from "./CommandOutput"

interface CommandBodyProps {
	command: string
	commandPatterns: { pattern: string; description?: string }[]
	allowedCommands: string[]
	deniedCommands: string[]
	isExpanded: boolean
	output: string
	handleAllowPatternChange: (p: string) => void
	handleDenyPatternChange: (p: string) => void
}

export const CommandBody = ({
	command,
	commandPatterns,
	allowedCommands,
	deniedCommands,
	isExpanded,
	output,
	handleAllowPatternChange,
	handleDenyPatternChange,
}: CommandBodyProps) => {
	return (
		<div className="bg-vscode-editor-background border border-vscode-border rounded-xs ml-6 mt-2">
			<div className="p-2">
				<CodeBlock source={command} language="shell" />
				<OutputContainer isExpanded={isExpanded} output={output} />
			</div>
			{command && command.trim() && (
				<CommandPatternSelector
					patterns={commandPatterns}
					allowedCommands={allowedCommands}
					deniedCommands={deniedCommands}
					onAllowPatternChange={handleAllowPatternChange}
					onDenyPatternChange={handleDenyPatternChange}
				/>
			)}
		</div>
	)
}
