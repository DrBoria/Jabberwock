"use client"

import { Check, ChevronsUpDown, Plus, Minus, SlidersHorizontal } from "lucide-react"

import type { JabberwockSettings } from "@jabberwock/types"
import { EVALS_SETTINGS } from "@jabberwock/types"

import {
	Button,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Label,
} from "@/components/ui"
import { cn } from "@/lib/utils"
import { SettingsDiff } from "../settings-diff"

import type { ConfigSelection, ImportedSettings } from "../utils"

export function ImportProviderSection({
	importedSettings,
	configSelections,
	onImportSettings,
	toggleConfigPopover,
	updateConfigSelection,
	addConfigSelection,
	removeConfigSelection,
	settings,
}: {
	importedSettings: ImportedSettings | null
	configSelections: ConfigSelection[]
	onImportSettings: (event: React.ChangeEvent<HTMLInputElement>) => void
	toggleConfigPopover: (id: string, open: boolean) => void
	updateConfigSelection: (id: string, configName: string) => void
	addConfigSelection: () => void
	removeConfigSelection: (id: string) => void
	settings: JabberwockSettings | undefined
}) {
	return (
		<div className="space-y-2 overflow-auto">
			<Button
				type="button"
				variant="secondary"
				onClick={() => document.getElementById("json-upload")?.click()}
				className="w-full">
				<SlidersHorizontal />
				Import Settings
			</Button>
			<input
				id="json-upload"
				type="file"
				accept="application/json"
				className="hidden"
				onChange={onImportSettings}
			/>
			{importedSettings && Object.keys(importedSettings.apiConfigs).length > 0 && (
				<div className="space-y-2">
					<Label>API Configs</Label>
					{configSelections.map((selection, index) => (
						<div key={selection.id} className="flex items-center gap-2">
							<Popover
								open={selection.popoverOpen}
								onOpenChange={(open) => toggleConfigPopover(selection.id, open)}>
								<PopoverTrigger asChild>
									<Button
										variant="input"
										role="combobox"
										aria-expanded={selection.popoverOpen}
										className="flex items-center justify-between flex-1">
										<div>{selection.configName || "Select config"}</div>
										<ChevronsUpDown className="opacity-50" />
									</Button>
								</PopoverTrigger>
								<PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]">
									<Command>
										<CommandInput placeholder="Search configs..." className="h-9" />
										<CommandList>
											<CommandEmpty>No config found.</CommandEmpty>
											<CommandGroup>
												{Object.keys(importedSettings.apiConfigs).map((configName) => (
													<CommandItem
														key={configName}
														value={configName}
														onSelect={() =>
															updateConfigSelection(selection.id, configName)
														}>
														{configName}
														{configName === importedSettings.currentApiConfigName && (
															<span className="ml-2 text-xs text-muted-foreground">
																(default)
															</span>
														)}
														<Check
															className={cn(
																"ml-auto size-4",
																configName === selection.configName
																	? "opacity-100"
																	: "opacity-0",
															)}
														/>
													</CommandItem>
												))}
											</CommandGroup>
										</CommandList>
									</Command>
								</PopoverContent>
							</Popover>
							{index === configSelections.length - 1 ? (
								<Button
									type="button"
									variant="outline"
									size="icon"
									onClick={addConfigSelection}
									className="shrink-0">
									<Plus className="size-4" />
								</Button>
							) : (
								<Button
									type="button"
									variant="outline"
									size="icon"
									onClick={() => removeConfigSelection(selection.id)}
									className="shrink-0">
									<Minus className="size-4" />
								</Button>
							)}
						</div>
					))}
				</div>
			)}
			{settings && (
				<SettingsDiff
					defaultSettings={EVALS_SETTINGS as unknown as JabberwockSettings}
					customSettings={settings}
				/>
			)}
		</div>
	)
}
