import { Server } from "lucide-react"
import { Container } from "@src/shared/ui/layouts/Container"
import type { StatusBarProps } from "../types"
import { StatusIndicator } from "./StatusIndicator"
import { ExpandChevron } from "../ExpandChevron"

export const StatusBar = ({
	status,
	serverName,
	responseText,
	isResponseExpanded,
	onToggleResponseExpand,
	t,
}: StatusBarProps) => (
	<Container $preset="toolbar" $gap="8px" $mb="4px">
		<Container $preset="row" $gap="4px">
			<Server size={16} className="text-vscode-descriptionForeground" />
			{serverName && <span className="font-bold text-vscode-foreground">{serverName}</span>}
		</Container>
		<Container $preset="row-reverse" $gap="8px" $p="0 4px">
			<StatusIndicator status={status} t={t} />
			<ExpandChevron
				responseText={responseText}
				isExpanded={isResponseExpanded}
				onToggle={onToggleResponseExpand}
			/>
		</Container>
	</Container>
)
