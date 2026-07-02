import { SectionHeader } from "@src/features/settings/components/shared/SectionHeader"
import type { ErrorStateProps } from "./types"

export const ErrorState = ({ t, title, message, extra }: ErrorStateProps) => (
	<div>
		<SectionHeader>{t("worktrees:title")}</SectionHeader>
		<div className="px-5 text-sm">
			<p className="text-vscode-descriptionForeground">{title}</p>
			<p>{message}</p>
			{extra}
		</div>
	</div>
)
