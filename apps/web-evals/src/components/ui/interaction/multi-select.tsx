import * as React from "react"
import fuzzysort from "fuzzysort"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "../overlays/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./command"
import { MultiSelectTriggerContent, type MultiSelectProps } from "./multi-select-trigger"

export const MultiSelect = React.forwardRef<HTMLDivElement, MultiSelectProps>(
	(
		{
			options,
			onValueChange,
			variant,
			value,
			defaultValue = [],
			placeholder = "Select options",
			maxCount = 3,
			modalPopover = false,
			popoverAutoWidth = false,
			footer,
			className,
			...props
		},
		ref,
	) => {
		const [internalSelectedValues, setInternalSelectedValues] = React.useState<string[]>(defaultValue)
		const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)
		const isControlled = value !== undefined
		const selectedValues = isControlled ? value : internalSelectedValues

		const setSelectedValues = React.useCallback(
			(newValues: string[]) => {
				if (!isControlled) setInternalSelectedValues(newValues)
				onValueChange(newValues)
			},
			[isControlled, onValueChange],
		)

		const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === "Enter") setIsPopoverOpen(true)
			else if (event.key === "Backspace" && !event.currentTarget.value) {
				if (!selectedValues.length) return
				setSelectedValues(selectedValues.slice(0, -1))
			}
		}

		const toggleOption = (option: string) => {
			setSelectedValues(
				selectedValues.includes(option)
					? selectedValues.filter((value) => value !== option)
					: [...selectedValues, option],
			)
		}

		const handleTogglePopover = () => setIsPopoverOpen((prev) => !prev)
		const clearExtraOptions = () => setSelectedValues(selectedValues.slice(0, maxCount))
		const searchResultsRef = React.useRef<Map<string, number>>(new Map())
		const searchValueRef = React.useRef("")

		const onSelectAll = () => {
			const values = Array.from(searchResultsRef.current.keys())
			if (
				selectedValues.length === values.length &&
				selectedValues.sort().join(",") === values.sort().join(",")
			) {
				setSelectedValues([])
				return
			}
			setSelectedValues(values)
		}

		const onFilter = React.useCallback(
			(value: string, search: string) => {
				if (searchValueRef.current !== search) {
					searchValueRef.current = search
					searchResultsRef.current.clear()
					for (const {
						obj: { value: v },
						score,
					} of fuzzysort.go(search, options, { key: "label" }))
						searchResultsRef.current.set(v, score)
				}
				if (value === "all") return searchResultsRef.current.size > 1 ? 0.01 : 0
				return searchResultsRef.current.get(value) ?? 0
			},
			[options],
		)

		return (
			<Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen} modal={modalPopover}>
				<PopoverTrigger asChild>
					<div
						ref={ref}
						{...props}
						onClick={handleTogglePopover}
						className={cn(
							"flex w-full rounded-sm min-h-9 h-auto items-center justify-between [&_svg]:pointer-events-auto",
							"font-medium border border-input bg-input hover:opacity-80 cursor-pointer",
							className,
						)}>
						<MultiSelectTriggerContent
							selectedValues={selectedValues}
							variant={variant}
							maxCount={maxCount}
							placeholder={placeholder}
							options={options}
							onToggleOption={toggleOption}
							onClearExtra={clearExtraOptions}
						/>
					</div>
				</PopoverTrigger>
				<PopoverContent
					className={cn("p-0", popoverAutoWidth ? "w-auto" : "w-[var(--radix-popover-trigger-width)]")}
					align="start"
					onEscapeKeyDown={() => setIsPopoverOpen(false)}>
					<Command filter={onFilter}>
						<CommandInput placeholder="Search" onKeyDown={handleInputKeyDown} />
						<CommandList>
							<CommandEmpty>No results found.</CommandEmpty>
							<CommandGroup>
								{options.map((option) => (
									<CommandItem
										key={option.value}
										value={option.value}
										onSelect={() => toggleOption(option.value)}
										className="flex items-center justify-between">
										<span>{option.label}</span>
										<Check
											className={cn(
												"text-accent group-data-[selected=true]:text-accent-foreground size-4",
												{ "opacity-0": !selectedValues.includes(option.value) },
											)}
										/>
									</CommandItem>
								))}
								<CommandItem
									key="all"
									value="all"
									onSelect={onSelectAll}
									className="flex items-center justify-between">
									<span>Select All</span>
								</CommandItem>
							</CommandGroup>
						</CommandList>
					</Command>
					{footer && <div className="border-t p-2">{footer}</div>}
				</PopoverContent>
			</Popover>
		)
	},
)

MultiSelect.displayName = "MultiSelect"
