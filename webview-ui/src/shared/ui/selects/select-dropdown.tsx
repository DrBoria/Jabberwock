import * as React from "react"
import { CaretUpIcon } from "@radix-ui/react-icons"
import { Fzf } from "fzf"
import { cn } from "@/lib/utils"
import { useJabberwockPortal } from "@/features/foundation/ui/hooks/useJabberwock/useJabberwockPortal"
import { Popover, PopoverContent, PopoverTrigger } from "../overlays/popover"
import { StandardTooltip } from "../tooltips/standard-tooltip"

import {
	DropdownOptionType,
	type DropdownOption,
	type SelectDropdownProps,
	getDisplayText,
	buildSearchableItems,
	filterOptions,
	groupOptions,
	type SelectDropdownInnerProps,
	type DropdownTriggerProps,
} from "../selects/select-dropdown-utils"
import { DropdownSearch } from "../selects/select-dropdown-search"
import { DropdownItemComponent } from "../selects/select-dropdown-item"

const SelectDropdownInner: React.FC<SelectDropdownInnerProps> = (p) => (
	<Popover open={p.open} onOpenChange={p.onOpenChange} data-testid="dropdown-root">
		{p.title ? <StandardTooltip content={p.title}>{p.triggerContent}</StandardTooltip> : p.triggerContent}
		<PopoverContent
			align={p.align}
			sideOffset={p.sideOffset}
			container={p.portalContainer}
			data-testid="dropdown-content"
			className={cn("p-0 overflow-hidden", p.contentClassName)}>
			<div className="flex flex-col w-full">
				{!p.disableSearch && (
					<DropdownSearch
						searchValue={p.searchValue}
						onSearchChange={p.onSearchChange}
						onClearSearch={p.onClearSearch}
					/>
				)}
				<div className="max-h-[300px] overflow-y-auto">
					{p.showNoResults ? (
						<div className="py-2 px-3 text-sm text-vscode-foreground/70">No results found</div>
					) : (
						<div className="py-1">
							{p.groupedOptions.map((option, index) => (
								<DropdownItemComponent
									key={`${option.type || "item"}-${option.value || index}`}
									option={option}
									index={index}
									currentValue={p.value}
									shortcutText={p.shortcutText}
									itemClassName={p.itemClassName}
									renderItem={p.renderItem}
									onSelect={p.handleSelect}
								/>
							))}
						</div>
					)}
				</div>
			</div>
		</PopoverContent>
	</Popover>
)

const DropdownTrigger: React.FC<DropdownTriggerProps> = ({ ref, disabled, triggerClassName, displayText }) => (
	<PopoverTrigger
		ref={ref}
		disabled={disabled}
		data-testid="dropdown-trigger"
		className={cn(
			"w-full min-w-0 max-w-full inline-flex items-center gap-1.5 relative whitespace-nowrap px-1.5 py-1 text-xs",
			"bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md text-vscode-foreground w-auto",
			"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
			disabled
				? "opacity-50 cursor-not-allowed"
				: "opacity-90 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
			triggerClassName,
		)}>
		<CaretUpIcon className="pointer-events-none opacity-80 flex-shrink-0 size-3" />
		<span className="truncate">{displayText}</span>
	</PopoverTrigger>
)

function useSelectDropdown(
	value: string,
	options: DropdownOption[],
	onChange: (value: string) => void,
	placeholder: string,
	disableSearch: boolean,
) {
	const [open, setOpen] = React.useState(false)
	const [searchValue, setSearchValue] = React.useState("")
	const portalContainer = useJabberwockPortal("jabberwock-portal")
	const selectedOption = React.useMemo(() => options.find((o) => o.value === value), [options, value])
	const displayText = React.useMemo(
		() => getDisplayText(value, selectedOption, placeholder),
		[value, selectedOption, placeholder],
	)
	const onOpenChange = React.useCallback((o: boolean) => {
		setOpen(o)
		if (!o) requestAnimationFrame(() => setSearchValue(""))
	}, [])
	const onClearSearch = React.useCallback(() => setSearchValue(""), [])
	const searchableItems = React.useMemo(() => buildSearchableItems(options), [options])
	const fzfInstance = React.useMemo(
		() => new Fzf(searchableItems, { selector: (item) => item.searchStr }),
		[searchableItems],
	)
	const filteredOptions = React.useMemo(
		() => filterOptions(options, searchValue, fzfInstance, disableSearch),
		[options, searchValue, fzfInstance, disableSearch],
	)
	const groupedOptions = React.useMemo(() => groupOptions(filteredOptions), [filteredOptions])
	const handleSelect = React.useCallback(
		(optionValue: string) => {
			const option = options.find((opt) => opt.value === optionValue)
			if (!option || option.disabled) return
			if (option.type === DropdownOptionType.ACTION) {
				window.postMessage({ type: "action", action: option.value })
				setSearchValue("")
				setOpen(false)
				return
			}
			onChange(option.value)
			setSearchValue("")
			setOpen(false)
		},
		[onChange, options],
	)
	const showNoResults = filteredOptions.length === 0 && !!searchValue
	return {
		open,
		searchValue,
		onSearchChange: setSearchValue,
		portalContainer,
		selectedOption,
		displayText,
		onOpenChange,
		onClearSearch,
		fzfInstance,
		filteredOptions,
		groupedOptions,
		handleSelect,
		showNoResults,
	}
}

const SelectDropdownInnerMain: React.FC<
	SelectDropdownProps & { forwardedRef: React.Ref<React.ElementRef<typeof PopoverTrigger>> }
> = (props) => {
	const {
		open,
		searchValue,
		portalContainer,
		displayText,
		onOpenChange,
		onClearSearch,
		groupedOptions,
		handleSelect,
		showNoResults,
		onSearchChange,
	} = useSelectDropdown(props.value, props.options, props.onChange, props.placeholder || "", !!props.disableSearch)
	return (
		<SelectDropdownInner
			open={open}
			title={props.title || ""}
			triggerContent={
				<DropdownTrigger
					ref={props.forwardedRef}
					disabled={!!props.disabled}
					triggerClassName={props.triggerClassName || ""}
					displayText={displayText}
				/>
			}
			portalContainer={portalContainer}
			align={props.align || "start"}
			sideOffset={props.sideOffset ?? 4}
			contentClassName={props.contentClassName || ""}
			disableSearch={!!props.disableSearch}
			searchValue={searchValue}
			onSearchChange={onSearchChange}
			onClearSearch={onClearSearch}
			onOpenChange={onOpenChange}
			showNoResults={showNoResults}
			groupedOptions={groupedOptions}
			value={props.value}
			shortcutText={props.shortcutText || ""}
			itemClassName={props.itemClassName || ""}
			renderItem={props.renderItem}
			handleSelect={handleSelect}
		/>
	)
}

const SelectDropdownWithRef = React.forwardRef<React.ElementRef<typeof PopoverTrigger>, SelectDropdownProps>(
	(props, ref) => <SelectDropdownInnerMain {...props} forwardedRef={ref} />,
)

export const SelectDropdown = React.memo(SelectDropdownWithRef)

SelectDropdown.displayName = "SelectDropdown"
