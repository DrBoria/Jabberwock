import React from "react"
import type { ClineMessage } from "@jabberwock/types"
import { CommandExecution } from "../../CommandExecution"

interface CommandAskProps {
	message: ClineMessage
	icon: React.ReactNode
	title: React.ReactNode
}

export const CommandAsk: React.FC<CommandAskProps> = ({ message, icon, title }) => (
	<CommandExecution
		executionId={message.ts.toString()}
		text={message.text}
		icon={icon as JSX.Element}
		title={title as JSX.Element}
	/>
)
