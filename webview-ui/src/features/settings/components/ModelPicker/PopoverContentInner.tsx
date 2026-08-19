import { X, Check } from "lucide-react"
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@src/shared/ui/overlays/command"
import { PopoverContent } from "@src/shared/ui/overlays/popover"
import { cn } from "@src/lib/utils"
import type { PopoverContentInnerProps } from "./types"

export const PopoverContentInner: React.FC<PopoverContentInnerProps> = ({
	searchValue,
	onClearSearch,
	onSelect,
	modelIds,
	displayValue,
	setSearchValue,
}) => (
	<PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]">
		<Command>
			<div className="relative">
				<CommandInput
					value={searchValue}
					onValueChange={setSearchValue}
					placeholder=""
					className="h-9 mr-4"
					data-testid="model-input"
				/>
				{searchValue.length > 0 && (
					<div className="absolute right-2 top-0 bottom-0 flex items-center justify-center">
						<X
							className="text-vscode-input-foreground opacity-50 hover:opacity-100 size-4 p-0.5 cursor-pointer"
							onClick={onClearSearch}
						/>
					</div>
				)}
			</div>
			<CommandList>
				<CommandEmpty>{searchValue && <div className="py-2 px-1 text-sm" />}</CommandEmpty>
				<CommandGroup>
					{modelIds.map((model) => (
						<CommandItem
							key={model}
							value={model}
							onSelect={onSelect}
							data-testid={`model-option-${model}`}>
							<span className="truncate" title={model}>
								{model}
							</span>
							<Check
								className={cn(
									"size-4 p-0.5 ml-auto",
									model === displayValue ? "opacity-100" : "opacity-0",
								)}
							/>
						</CommandItem>
					))}
				</CommandGroup>
			</CommandList>
			{searchValue && !modelIds.includes(searchValue) && (
				<div className="p-1 border-t border-vscode-input-border">
					<CommandItem data-testid="use-custom-model" value={searchValue} onSelect={onSelect} />
				</div>
			)}
		</Command>
	</PopoverContent>
)
