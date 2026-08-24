import React from "react"
import { ListChecks, LayoutList, Settings, CheckCheck, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { observer } from "mobx-react-lite"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useAutoApprovalToggles } from "@/hooks/useAutoApprovalToggles"
import { useAutoApprovalState } from "@/hooks/useAutoApprovalState"
import { useJabberwockPortal } from "@/features/foundation/ui/hooks/useJabberwock/useJabberwockPortal"
import { Popover, PopoverContent, PopoverTrigger } from "@src/shared/ui/overlays/popover"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import { ToggleSwitch } from "@src/shared/ui/buttons/toggle-switch"
import { Button } from "@src/shared/ui/buttons/button"
import { autoApproveSettingsConfig } from "@src/features/settings/components/auto-approve-controls/AutoApproveToggle"
import type { AutoApproveSetting } from "@src/features/settings/components/auto-approve-controls/AutoApproveToggle"
import { rootStore } from "@src/features/store"
import type { AutoApproveDropdownProps } from "./types"
import { SETTERS, useTriggerLabels } from "./helpers"

export const AutoApproveDropdown = observer(({ disabled = false, triggerClassName = "" }: AutoApproveDropdownProps) => {
	const [open, setOpen] = React.useState(false)
	const portalContainer = useJabberwockPortal("jabberwock-portal")
	const { t } = useAppTranslation()
	const s = rootStore.extensionState
	const autoApprovalEnabled = s.autoApprovalEnabled
	const toggles = useAutoApprovalToggles()
	const { effectiveAutoApprovalEnabled } = useAutoApprovalState(toggles, autoApprovalEnabled)
	const enabledCount = Object.values(toggles).filter(Boolean).length
	const totalCount = Object.keys(toggles).length
	const { getTriggerLabel, getTriggerLabelShort } = useTriggerLabels(
		enabledCount,
		totalCount,
		effectiveAutoApprovalEnabled,
	)

	const settingsArray = React.useMemo(
		() =>
			Object.values(autoApproveSettingsConfig).map(({ key, icon, labelKey, descriptionKey }) => ({
				key,
				labelKey,
				descriptionKey,
				icon,
			})),
		[],
	)

	const onAutoApproveToggle = React.useCallback((key: AutoApproveSetting, value: boolean) => SETTERS[key](value), [])

	const handleSelectAll = React.useCallback(
		() => Object.values(autoApproveSettingsConfig).forEach(({ key }) => onAutoApproveToggle(key, true)),
		[onAutoApproveToggle],
	)
	const handleSelectNone = React.useCallback(
		() => Object.values(autoApproveSettingsConfig).forEach(({ key }) => onAutoApproveToggle(key, false)),
		[onAutoApproveToggle],
	)
	const handleAutoApprovalToggle = React.useCallback(
		() => rootStore.setAutoApprovalEnabled(!autoApprovalEnabled),
		[autoApprovalEnabled],
	)

	const triggerLabel = getTriggerLabel()
	const triggerLabelShort = getTriggerLabelShort()
	const isDisabled = !effectiveAutoApprovalEnabled
	const disabledClassName = "opacity-50 hover:opacity-50 cursor-not-allowed"
	const disabledClassNameMap = isDisabled && "opacity-50 cursor-not-allowed hover:opacity-50"

	const handleOpenSettings = React.useCallback(() => {
		rootStore.windowManager.pushWindow("settings")
		setOpen(false)
	}, [])

	return (
		<Popover open={open} onOpenChange={setOpen} data-testid="auto-approve-dropdown-root">
			<StandardTooltip content={triggerLabel}>
				<PopoverTrigger
					disabled={disabled}
					data-testid="dropdown-trigger"
					className={cn(
						"min-w-0 inline-flex items-center relative whitespace-nowrap px-1.5 py-1 text-xs",
						"bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md text-vscode-foreground",
						"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
						disabled
							? "opacity-50 cursor-not-allowed"
							: "opacity-90 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
						triggerClassName,
					)}>
					{effectiveAutoApprovalEnabled ? (
						<CheckCheck className="size-3 flex-shrink-0" />
					) : (
						<X className="size-3 flex-shrink-0" />
					)}
					<span className="hidden min-[300px]:inline truncate min-w-0">{triggerLabel}</span>
					<span className="inline min-[300px]:hidden min-w-0">{triggerLabelShort}</span>
				</PopoverTrigger>
			</StandardTooltip>
			<PopoverContent
				align="start"
				sideOffset={4}
				container={portalContainer}
				className="p-0 overflow-hidden w-[min(440px,calc(100vw-2rem))]"
				onOpenAutoFocus={(e) => e.preventDefault()}>
				<div className="flex flex-col w-full">
					<div className="p-3 border-b border-vscode-dropdown-border">
						<div className="flex items-center justify-between gap-1 pr-1 pb-2">
							<h4 className="m-0 font-bold text-base text-vscode-foreground">
								{t("chat:autoApprove.title")}
							</h4>
							<Settings
								className="inline mb-0.5 mr-1 size-4 cursor-pointer"
								onClick={handleOpenSettings}
							/>
						</div>
						<p className="m-0 text-xs text-vscode-descriptionForeground">
							{t("chat:autoApprove.description")}
						</p>
					</div>
					<div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-x-2 gap-y-2 p-3">
						{settingsArray.map(({ key, labelKey, descriptionKey, icon }) => {
							const isEnabled = toggles[key]
							return (
								<StandardTooltip key={key} content={t(descriptionKey)}>
									<Button
										variant={isEnabled ? "primary" : "secondary"}
										onClick={() => onAutoApproveToggle(key, !isEnabled)}
										className={cn(
											"flex items-center gap-2 px-2 py-2 text-sm text-left justify-start h-auto",
											"transition-all duration-150",
											isDisabled && disabledClassNameMap,
											!isEnabled && "bg-vscode-button-background/15",
										)}
										disabled={isDisabled}
										data-testid={`auto-approve-${key}`}>
										<span className={`codicon codicon-${icon} text-sm flex-shrink-0`} />
										<span className="flex-1 truncate">{t(labelKey)}</span>
									</Button>
								</StandardTooltip>
							)
						})}
					</div>
					<div className="flex flex-row items-center justify-between px-2 py-2 border-t border-vscode-dropdown-border">
						<div className="flex flex-row gap-1">
							<Button
								variant="ghost"
								size="sm"
								aria-label={t("chat:autoApprove.selectAll")}
								onClick={handleSelectAll}
								disabled={isDisabled}
								className={cn(
									"gap-1 px-2 py-1 text-base font-bold h-auto",
									isDisabled && disabledClassName,
								)}>
								<ListChecks className="w-3.5 h-3.5" />
								<span>{t("chat:autoApprove.all")}</span>
							</Button>
							<Button
								variant="ghost"
								size="sm"
								aria-label={t("chat:autoApprove.selectNone")}
								onClick={handleSelectNone}
								disabled={isDisabled}
								className={cn(
									"gap-1 px-2 py-1 text-base font-bold h-auto",
									isDisabled && disabledClassName,
								)}>
								<LayoutList className="w-3.5 h-3.5" />
								<span>{t("chat:autoApprove.none")}</span>
							</Button>
						</div>
						<label
							className="flex items-center gap-2 pr-2 cursor-pointer"
							onClick={(e) => {
								if ((e.target as HTMLElement).closest('[role="switch"]')) {
									e.preventDefault()
									return
								}
								handleAutoApprovalToggle()
							}}>
							<ToggleSwitch
								checked={effectiveAutoApprovalEnabled}
								aria-label="Toggle auto-approval"
								onChange={handleAutoApprovalToggle}
							/>
							<span className={cn("text-sm font-bold select-none")}>Enabled</span>
						</label>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
})
