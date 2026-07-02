import React from "react"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { FoldVertical } from "lucide-react"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { Slider } from "@src/shared/ui/inputs/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/shared/ui/selects/select"

import { rootStore } from "@src/features/store"
import { SearchableSetting } from "../shared/SearchableSetting"
import { SetCachedStateField } from "../shared/types"

type AutoCondenseSettingsProps = {
	autoCondenseContext: boolean
	autoCondenseContextPercent: number
	listApiConfigMeta: Array<{ id: string; name: string }>
	profileThresholds: Record<string, number>
	setCachedStateField: SetCachedStateField<"autoCondenseContext" | "autoCondenseContextPercent" | "profileThresholds">
}

function getCurrentThresholdValue(
	selectedThresholdProfile: string,
	autoCondenseContextPercent: number,
	profileThresholds: Record<string, number>,
): number {
	if (selectedThresholdProfile === "default") {
		return autoCondenseContextPercent
	}
	const profileThreshold = profileThresholds[selectedThresholdProfile]
	if (profileThreshold === undefined || profileThreshold === -1) {
		return autoCondenseContextPercent
	}
	return profileThreshold
}

function getCheckboxChecked(e: Event | React.FormEvent<HTMLElement>): boolean {
	if (e.target instanceof HTMLInputElement) {
		return e.target.checked
	}
	return false
}

export const AutoCondenseSettings = ({
	autoCondenseContext,
	autoCondenseContextPercent,
	listApiConfigMeta,
	profileThresholds,
	setCachedStateField,
}: AutoCondenseSettingsProps) => {
	const { t } = useAppTranslation()
	const [selectedThresholdProfile, setSelectedThresholdProfile] = React.useState<string>("default")

	const currentThreshold = getCurrentThresholdValue(
		selectedThresholdProfile,
		autoCondenseContextPercent,
		profileThresholds,
	)

	const handleThresholdChange = (value: number) => {
		if (selectedThresholdProfile === "default") {
			setCachedStateField("autoCondenseContextPercent", value)
		} else {
			const newThresholds = {
				...profileThresholds,
				[selectedThresholdProfile]: value,
			}
			setCachedStateField("profileThresholds", newThresholds)
			rootStore.settings.updateSettings({ profileThresholds: newThresholds })
		}
	}

	return (
		<>
			<SearchableSetting
				settingId="context-auto-condense"
				section="contextManagement"
				label={t("settings:contextManagement.autoCondenseContext.name")}>
				<VSCodeCheckbox
					checked={autoCondenseContext}
					onChange={(e: Event | React.FormEvent<HTMLElement>) =>
						setCachedStateField("autoCondenseContext", getCheckboxChecked(e))
					}
					data-testid="auto-condense-context-checkbox">
					<span className="font-medium">{t("settings:contextManagement.autoCondenseContext.name")}</span>
				</VSCodeCheckbox>
			</SearchableSetting>
			{autoCondenseContext && (
				<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
					<div className="flex items-center gap-4 font-bold">
						<FoldVertical size={16} />
						<div>{t("settings:contextManagement.condensingThreshold.label")}</div>
					</div>
					<div>
						<Select
							value={selectedThresholdProfile || "default"}
							onValueChange={(value) => {
								setSelectedThresholdProfile(value)
							}}
							data-testid="threshold-profile-select">
							<SelectTrigger className="w-full">
								<SelectValue
									placeholder={
										t("settings:contextManagement.condensingThreshold.selectProfile") ||
										"Select profile for threshold"
									}
								/>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="default">
									{t("settings:contextManagement.condensingThreshold.defaultProfile") ||
										"Default (applies to all unconfigured profiles)"}
								</SelectItem>
								{(listApiConfigMeta || []).map((config) => {
									const profileThreshold = profileThresholds[config.id]
									const thresholdDisplay = getThresholdDisplay(
										profileThreshold,
										autoCondenseContextPercent,
										t,
									)
									return (
										<SelectItem key={config.id} value={config.id}>
											{config.name}
											{thresholdDisplay}
										</SelectItem>
									)
								})}
							</SelectContent>
						</Select>
					</div>

					<div>
						<div className="flex items-center gap-2">
							<Slider
								min={10}
								max={100}
								step={1}
								value={[currentThreshold]}
								onValueChange={([value]) => handleThresholdChange(value)}
								data-testid="condense-threshold-slider"
							/>
							<span className="w-20">{currentThreshold}%</span>
						</div>
						<div className="text-vscode-descriptionForeground text-sm mt-1">
							{selectedThresholdProfile === "default"
								? t("settings:contextManagement.condensingThreshold.defaultDescription", {
										threshold: autoCondenseContextPercent,
									})
								: t("settings:contextManagement.condensingThreshold.profileDescription")}
						</div>
					</div>
				</div>
			)}
		</>
	)
}

function getThresholdDisplay(
	profileThreshold: number | undefined,
	autoCondenseContextPercent: number,
	t: ReturnType<typeof useAppTranslation>["t"],
): string {
	if (profileThreshold === undefined) {
		return ""
	}
	if (profileThreshold === -1) {
		return ` ${t("settings:contextManagement.condensingThreshold.usesGlobal", {
			threshold: autoCondenseContextPercent,
		})}`
	}
	return ` (${profileThreshold}%)`
}
