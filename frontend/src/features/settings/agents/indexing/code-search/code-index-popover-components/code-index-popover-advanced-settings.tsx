import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { Slider } from "@src/shared/ui/inputs/slider"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import { CODEBASE_INDEX_DEFAULTS } from "@jabberwock/types"
import type { LocalCodeIndexSettings } from "../code-index-popover-logic/code-index-popover-types"

export const AdvancedSettingsSection: React.FC<{
	currentSettings: LocalCodeIndexSettings
	updateSetting: (key: keyof LocalCodeIndexSettings, value: unknown) => void
	t: (key: string, options?: Record<string, unknown>) => string
	isAdvancedSettingsOpen: boolean
	setIsAdvancedSettingsOpen: (open: boolean) => void
}> = ({ currentSettings, updateSetting, t, isAdvancedSettingsOpen, setIsAdvancedSettingsOpen }) => (
	<div className="mt-4">
		<button
			onClick={() => setIsAdvancedSettingsOpen(!isAdvancedSettingsOpen)}
			className="flex items-center text-xs text-vscode-foreground hover:text-vscode-textLink-foreground focus:outline-none"
			aria-expanded={isAdvancedSettingsOpen}>
			<span className={`codicon codicon-${isAdvancedSettingsOpen ? "chevron-down" : "chevron-right"} mr-1`} />
			<span className="text-base font-semibold">{t("settings:codeIndex.advancedConfigLabel")}</span>
		</button>
		{isAdvancedSettingsOpen && (
			<div className="mt-4 space-y-4">
				<div className="space-y-2">
					<div className="flex items-center gap-2">
						<label className="text-sm font-medium">{t("settings:codeIndex.searchMinScoreLabel")}</label>
						<StandardTooltip content={t("settings:codeIndex.searchMinScoreDescription")}>
							<span className="codicon codicon-info text-xs text-vscode-descriptionForeground cursor-help" />
						</StandardTooltip>
					</div>
					<div className="flex items-center gap-2">
						<Slider
							min={CODEBASE_INDEX_DEFAULTS.MIN_SEARCH_SCORE}
							max={CODEBASE_INDEX_DEFAULTS.MAX_SEARCH_SCORE}
							step={CODEBASE_INDEX_DEFAULTS.SEARCH_SCORE_STEP}
							value={[
								currentSettings.codebaseIndexSearchMinScore ??
									CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_MIN_SCORE,
							]}
							onValueChange={(values) => updateSetting("codebaseIndexSearchMinScore", values[0])}
							className="flex-1"
							data-testid="search-min-score-slider"
						/>
						<span className="w-12 text-center">
							{(
								currentSettings.codebaseIndexSearchMinScore ??
								CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_MIN_SCORE
							).toFixed(2)}
						</span>
						<VSCodeButton
							appearance="icon"
							title={t("settings:codeIndex.resetToDefault")}
							onClick={() =>
								updateSetting(
									"codebaseIndexSearchMinScore",
									CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_MIN_SCORE,
								)
							}>
							<span className="codicon codicon-discard" />
						</VSCodeButton>
					</div>
				</div>
				<div className="space-y-2">
					<div className="flex items-center gap-2">
						<label className="text-sm font-medium">{t("settings:codeIndex.searchMaxResultsLabel")}</label>
						<StandardTooltip content={t("settings:codeIndex.searchMaxResultsDescription")}>
							<span className="codicon codicon-info text-xs text-vscode-descriptionForeground cursor-help" />
						</StandardTooltip>
					</div>
					<div className="flex items-center gap-2">
						<Slider
							min={CODEBASE_INDEX_DEFAULTS.MIN_SEARCH_RESULTS}
							max={CODEBASE_INDEX_DEFAULTS.MAX_SEARCH_RESULTS}
							step={CODEBASE_INDEX_DEFAULTS.SEARCH_RESULTS_STEP}
							value={[
								currentSettings.codebaseIndexSearchMaxResults ??
									CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_RESULTS,
							]}
							onValueChange={(values) => updateSetting("codebaseIndexSearchMaxResults", values[0])}
							className="flex-1"
							data-testid="search-max-results-slider"
						/>
						<span className="w-12 text-center">
							{currentSettings.codebaseIndexSearchMaxResults ??
								CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_RESULTS}
						</span>
						<VSCodeButton
							appearance="icon"
							title={t("settings:codeIndex.resetToDefault")}
							onClick={() =>
								updateSetting(
									"codebaseIndexSearchMaxResults",
									CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_RESULTS,
								)
							}>
							<span className="codicon codicon-discard" />
						</VSCodeButton>
					</div>
				</div>
			</div>
		)}
	</div>
)
