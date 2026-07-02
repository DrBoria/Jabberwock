import React from "react"
import type { Notification } from "@jabberwock/types"
import { CommandExecution } from "../../../messages/components/command/execution"

interface CommandAskProps {
	message: Notification
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
