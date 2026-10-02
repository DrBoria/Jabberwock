import { Info } from "lucide-react"

export function WarningBanner({ show, t }: { show: boolean; t: (key: string) => string }) {
	if (!show) return null
	return (
		<div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-vscode-inputValidation-warningBackground border border-vscode-inputValidation-warningBorder text-sm">
			<Info />
			<span className="text-vscode-foreground">
				<span className="font-medium">{t("worktrees:noIncludeFileWarning")}</span>
				{" — "}
				<span className="text-vscode-descriptionForeground">{t("worktrees:noIncludeFileHint")}</span>
			</span>
		</div>
	)
}
