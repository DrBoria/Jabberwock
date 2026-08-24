import React from "react"
import { User } from "lucide-react"
import type { Notification } from "@jabberwock/types"
import { Markdown } from "./markdown"
import Thumbnails from "@src/features/foundation/components/ui/display/Thumbnails"

interface UserMessageProps {
	message: Notification
	t: (key: string, options?: Record<string, unknown>) => string
}

const headerStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: "10px",
	cursor: "default",
	marginBottom: "10px",
	wordBreak: "break-word",
}

export const UserMessage: React.FC<UserMessageProps> = ({ message, t }) => (
	<div className="group">
		<div style={headerStyle}>
			<User className="w-4 shrink-0" aria-label="User icon" />
			<span style={{ fontWeight: "bold" }}>{t("chat:feedback.youSaid")}</span>
		</div>
		<div className="pl-6 text-sm">
			<Markdown markdown={message.text || ""} />
			{message.images && message.images.length > 0 && (
				<Thumbnails images={message.images} style={{ marginTop: "8px" }} />
			)}
		</div>
	</div>
)
