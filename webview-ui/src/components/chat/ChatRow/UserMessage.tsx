import React from "react"
import { User } from "lucide-react"
import type { ClineMessage } from "@jabberwock/types"
import { Markdown } from "../Markdown"
import Thumbnails from "../../common/Thumbnails"

interface UserMessageProps {
	message: ClineMessage
	t: (key: string, options?: any) => string
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
