"use client"

import { Check, ChevronsUpDown, Plus, Minus } from "lucide-react"

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
} from "@/components/ui"
import { cn } from "@/lib/utils"

import type { ModelSelection } from "../utils"

export function ModelPickerSection({
	modelSelections,
	models,
	searchValue,
	onFilter,
	setSearchValue,
	toggleModelPopover,
	updateModelSelection,
	addModelSelection,
	removeModelSelection,
}: {
	modelSelections: ModelSelection[]
	models: Array<{ id: string; name: string }> | undefined
	searchValue: string
	onFilter: ((value: string, search: string) => number) | undefined
	setSearchValue: (value: string) => void
	toggleModelPopover: (id: string, open: boolean) => void
	updateModelSelection: (id: string, model: string) => void
	addModelSelection: () => void
	removeModelSelection: (id: string) => void
}) {
	return (
		<div className="space-y-2">
			{modelSelections.map((selection, index) => (
				<div key={selection.id} className="flex items-center gap-2">
					<Popover
						open={selection.popoverOpen}
						onOpenChange={(open) => toggleModelPopover(selection.id, open)}>
						<PopoverTrigger asChild>
							<Button
								variant="input"
								role="combobox"
								aria-expanded={selection.popoverOpen}
								className="flex items-center justify-between flex-1">
								<div>{models?.find(({ id }) => id === selection.model)?.name || "Select"}</div>
								<ChevronsUpDown className="opacity-50" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]">
							<Command filter={onFilter}>
								<CommandInput
									placeholder="Search"
									value={searchValue}
									onValueChange={setSearchValue}
									className="h-9"
								/>
								<CommandList>
									<CommandEmpty>No model found.</CommandEmpty>
									<CommandGroup>
										{models?.map(({ id, name }) => (
											<CommandItem
												key={id}
												value={id}
												onSelect={() => updateModelSelection(selection.id, id)}>
												{name}
												<Check
													className={cn(
														"ml-auto text-accent group-data-[selected=true]:text-accent-foreground size-4",
														id === selection.model ? "opacity-100" : "opacity-0",
													)}
												/>
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
					{index === modelSelections.length - 1 ? (
						<Button
							type="button"
							variant="outline"
							size="icon"
							onClick={addModelSelection}
							className="shrink-0">
							<Plus className="size-4" />
						</Button>
					) : (
						<Button
							type="button"
							variant="outline"
							size="icon"
							onClick={() => removeModelSelection(selection.id)}
							className="shrink-0">
							<Minus className="size-4" />
						</Button>
					)}
				</div>
			))}
		</div>
	)
}
