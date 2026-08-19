export function ErrorBanner({ show, error }: { show: boolean; error: string | null }) {
	if (!show || !error) return null
	return (
		<div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-vscode-inputValidation-errorBackground border border-vscode-inputValidation-errorBorder text-sm">
			<span className="codicon codicon-error text-vscode-errorForeground flex-shrink-0" />
			<p className="text-vscode-errorForeground">{error}</p>
		</div>
	)
}
