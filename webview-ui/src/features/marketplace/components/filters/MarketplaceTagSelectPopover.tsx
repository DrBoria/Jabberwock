import * as React from "react"
import { Button } from "@src/shared/ui/buttons/button"
import { Popover, PopoverContent, PopoverTrigger } from "@src/shared/ui/overlays/popover"
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@src/shared/ui/overlays/command"
import { X, ChevronsUpDown } from "lucide-react"
import { useAppTranslation } from "@/i18n/TranslationContext"

interface TagSelectPopoverProps {
	allTags: string[]
	filteredTags: string[]
	selectedTags: string[]
	tagSearch: string
	isPopoverOpen: boolean
	onOpenChange: (open: boolean) => void
	onTagSearchChange: (value: string) => void
	onTagsChange: (tags: string[]) => void
}

export function TagSelectPopover({
	allTags,
	filteredTags,
	selectedTags,
	tagSearch,
	isPopoverOpen,
	onOpenChange,
	onTagSearchChange,
	onTagsChange,
}: TagSelectPopoverProps) {
	const { t } = useAppTranslation()
	if (allTags.length === 0) return null
	return (
		<div className="flex-1">
			<Popover open={isPopoverOpen} onOpenChange={onOpenChange}>
				<PopoverTrigger asChild>
					<Button
						variant="combobox"
						role="combobox"
						aria-expanded={isPopoverOpen}
						className="w-full justify-between h-7">
						<span className="truncate">
							{selectedTags.length > 0
								? selectedTags
										.map((tag: string) => tag.charAt(0).toUpperCase() + tag.slice(1))
										.join(", ")
								: t("marketplace:filters.tags.label")}
						</span>
						<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent
					className="w-[var(--radix-popover-trigger-width)] p-0"
					onClick={(e) => e.stopPropagation()}>
					<Command>
						<div className="relative">
							<CommandInput
								className="h-9 pr-8"
								placeholder={t("marketplace:filters.tags.placeholder")}
								value={tagSearch}
								onValueChange={onTagSearchChange}
							/>
							{tagSearch && (
								<Button
									variant="ghost"
									size="icon"
									className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
									onClick={() => onTagSearchChange("")}>
									<X className="h-4 w-4" />
								</Button>
							)}
						</div>
						<CommandList className="max-h-[200px] overflow-y-auto bg-vscode-dropdown-background divide-y divide-vscode-panel-border">
							<CommandEmpty className="p-2 text-sm text-vscode-descriptionForeground">
								{t("marketplace:filters.tags.noResults")}
							</CommandEmpty>
							<CommandGroup>
								{filteredTags.map((tag: string) => (
									<CommandItem
										key={tag}
										value={tag}
										onSelect={() => {
											const isSelected = selectedTags.includes(tag)
											onTagsChange(
												isSelected
													? selectedTags.filter((t) => t !== tag)
													: [...selectedTags, tag],
											)
										}}
										data-selected={selectedTags.includes(tag)}
										className="grid grid-cols-[1rem_1fr] gap-2 cursor-pointer text-sm capitalize"
										onMouseDown={(e) => {
											e.stopPropagation()
											e.preventDefault()
										}}>
										{selectedTags.includes(tag) ? (
											<span className="codicon codicon-check" />
										) : (
											<span />
										)}
										{tag}
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</div>
	)
}
