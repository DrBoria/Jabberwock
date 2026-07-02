import prettyBytes from "pretty-bytes"

export function ProgressSection({
	show,
	copyProgress,
	t,
}: {
	show: boolean
	copyProgress: { bytesCopied: number; itemName: string } | null
	t: (key: string, options?: Record<string, unknown>) => string
}) {
	if (!show || !copyProgress) return null
	return (
		<div className="flex flex-col gap-2 px-3 py-3 rounded-lg bg-vscode-editor-background border border-vscode-panel-border">
			<div className="flex items-center gap-2 text-sm">
				<span className="codicon codicon-loading codicon-modifier-spin text-vscode-button-background" />
				<span className="text-vscode-foreground font-medium">{t("worktrees:copyingFiles")}</span>
			</div>
			<div className="text-xs text-vscode-descriptionForeground truncate">
				{t("worktrees:copyingProgress", {
					item: copyProgress.itemName,
					copied: prettyBytes(copyProgress.bytesCopied),
				})}
			</div>
		</div>
	)
}
