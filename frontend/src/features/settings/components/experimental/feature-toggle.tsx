import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"

interface FeatureToggleHeaderProps {
	enabled: boolean
	onChange: (value: boolean) => void
	name: string
	description: string
}

/**
 * Shared "feature on/off" header used by the experimental settings panels
 * (checkbox + bold name + muted description). Extracted so the panels don't
 * each re-implement the same toggle row (see `local/no-duplicated-logic`).
 */
export const FeatureToggleHeader = ({ enabled, onChange, name, description }: FeatureToggleHeaderProps) => (
	<div>
		<div className="flex items-center gap-2">
			<VSCodeCheckbox checked={enabled} onChange={(e) => onChange((e.target as HTMLInputElement).checked)}>
				<span className="font-medium">{name}</span>
			</VSCodeCheckbox>
		</div>
		<p className="text-vscode-descriptionForeground text-sm mt-0">{description}</p>
	</div>
)
