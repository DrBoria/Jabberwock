import React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@src/shared/ui/tooltips/tooltip"
import { TabList, TabTrigger } from "@src/features/foundation/components/ui/layout/Tab"
import { cn } from "@src/lib/utils"
import { settingsTabList, settingsTabTrigger, settingsTabTriggerActive, sectionNames } from "../constants"
import type { SectionName } from "../constants"
import type { TabSidebarProps } from "../types"

export function SettingsTabSidebar({ sections, activeTab, isCompactMode, onTabChange, tabRefs, t }: TabSidebarProps) {
	return (
		<TabList
			value={activeTab}
			onValueChange={(value) =>
				(sectionNames as readonly string[]).includes(value) && onTabChange(value as SectionName)
			}
			className={cn(settingsTabList)}
			data-compact={isCompactMode}
			data-testid="settings-tab-list">
			{sections.map(({ id, icon: Icon }) => {
				const isSelected = id === activeTab
				const triggerComponent = (
					<TabTrigger
						ref={(element) => (tabRefs.current[id] = element)}
						value={id}
						isSelected={isSelected}
						className={cn(
							isSelected ? `${settingsTabTrigger} ${settingsTabTriggerActive}` : settingsTabTrigger,
							"cursor-pointer focus:ring-0",
						)}
						data-testid={`tab-${id}`}
						data-compact={isCompactMode}>
						<div className={cn("flex items-center gap-2", isCompactMode && "justify-center")}>
							<Icon className="w-4 h-4" />
							<span className="tab-label">{t(`settings:sections.${id}`)}</span>
						</div>
					</TabTrigger>
				)

				if (isCompactMode) {
					return (
						<TooltipProvider key={id} delayDuration={300}>
							<Tooltip>
								<TooltipTrigger asChild onClick={() => onTabChange(id)}>
									{React.cloneElement(triggerComponent)}
								</TooltipTrigger>
								<TooltipContent side="right" className="text-base">
									<p className="m-0">{t(`settings:sections.${id}`)}</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)
				}

				return React.cloneElement(triggerComponent, { key: id })
			})}
		</TabList>
	)
}
