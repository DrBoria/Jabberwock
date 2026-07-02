import { useAppTranslation } from "@/i18n/TranslationContext"
import { Slider } from "@src/shared/ui/inputs/slider"
import { SearchableSetting } from "../shared/SearchableSetting"

interface SliderSettingConfig {
	settingId: string
	label: string
	description: string
	value: number
	defaultValue: number
	min: number
	max: number
	step: number
	suffix?: string
	onChange: (value: number) => void
}

const SliderSettingItem = ({ config }: { config: SliderSettingConfig }) => {
	const { t } = useAppTranslation()
	return (
		<SearchableSetting settingId={config.settingId} section="contextManagement" label={t(config.label)}>
			<span className="block font-medium mb-1">{t(config.label)}</span>
			<div className="flex items-center gap-2">
				<Slider
					min={config.min}
					max={config.max}
					step={config.step}
					value={[config.value]}
					onValueChange={([value]) => config.onChange(value)}
				/>
				<span className="w-20">
					{config.value ?? config.defaultValue}
					{config.suffix ?? ""}
				</span>
			</div>
			<div className="text-vscode-descriptionForeground text-sm mt-1">{t(config.description)}</div>
		</SearchableSetting>
	)
}

interface SliderSettingsProps {
	maxOpenTabsContext: number
	maxWorkspaceFiles: number
	maxGitStatusFiles: number
	writeDelayMs: number
	onChange: (field: string, value: number) => void
}

export const SliderSettings = ({
	maxOpenTabsContext,
	maxWorkspaceFiles,
	maxGitStatusFiles,
	writeDelayMs,
	onChange,
}: SliderSettingsProps) => {
	const sliders: SliderSettingConfig[] = [
		{
			settingId: "context-open-tabs",
			label: "settings:contextManagement.openTabs.label",
			description: "settings:contextManagement.openTabs.description",
			value: maxOpenTabsContext,
			defaultValue: 20,
			min: 0,
			max: 500,
			step: 1,
			onChange: (v) => onChange("maxOpenTabsContext", v),
		},
		{
			settingId: "context-workspace-files",
			label: "settings:contextManagement.workspaceFiles.label",
			description: "settings:contextManagement.workspaceFiles.description",
			value: maxWorkspaceFiles,
			defaultValue: 200,
			min: 0,
			max: 500,
			step: 1,
			onChange: (v) => onChange("maxWorkspaceFiles", v),
		},
		{
			settingId: "context-max-git-status-files",
			label: "settings:contextManagement.maxGitStatusFiles.label",
			description: "settings:contextManagement.maxGitStatusFiles.description",
			value: maxGitStatusFiles,
			defaultValue: 0,
			min: 0,
			max: 50,
			step: 1,
			onChange: (v) => onChange("maxGitStatusFiles", v),
		},
		{
			settingId: "context-write-delay",
			label: "settings:contextManagement.diagnostics.delayAfterWrite.label",
			description: "settings:contextManagement.diagnostics.delayAfterWrite.description",
			value: writeDelayMs,
			defaultValue: 0,
			min: 0,
			max: 5000,
			step: 100,
			suffix: "ms",
			onChange: (v) => onChange("writeDelayMs", v),
		},
	]
	return (
		<>
			{sliders.map((config) => (
				<SliderSettingItem key={config.settingId} config={config} />
			))}
		</>
	)
}
