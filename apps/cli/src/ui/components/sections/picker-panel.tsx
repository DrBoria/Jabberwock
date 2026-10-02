import { Box, Text } from "ink"

import type { AutocompleteItem } from "../autocomplete/index.js"
import { PickerSelect } from "../autocomplete/index.js"

export const PICKER_HEIGHT = 10

export interface PickerPanelState {
	isOpen: boolean
	results: AutocompleteItem[]
	selectedIndex: number
	activeTrigger: {
		renderItem: (item: AutocompleteItem, isSelected: boolean) => React.ReactNode
		emptyMessage?: string
	} | null
	isLoading: boolean
}

interface PickerPanelProps {
	pickerState: PickerPanelState
	handlePickerSelect: (item: AutocompleteItem) => void
	handlePickerClose: () => void
	handlePickerIndexChange: (index: number) => void
	isInputAreaActive: boolean
}

/**
 * Shared autocomplete picker panel.
 *
 * Both `DefaultInputArea` (default.tsx) and `FollowupCustomInput`
 * (FollowupContent.tsx) render the exact same `PickerSelect` block — same
 * results/selection wiring, same `renderItem` fallback. Extracted here so the
 * two sections don't copy the logic (see `local/no-duplicated-logic`).
 */
export function PickerPanel({
	pickerState,
	handlePickerSelect,
	handlePickerClose,
	handlePickerIndexChange,
	isInputAreaActive,
}: PickerPanelProps) {
	return (
		<Box flexDirection="column" height={PICKER_HEIGHT}>
			<PickerSelect
				results={pickerState.results}
				selectedIndex={pickerState.selectedIndex}
				maxVisible={PICKER_HEIGHT - 1}
				onSelect={handlePickerSelect}
				onEscape={handlePickerClose}
				onIndexChange={handlePickerIndexChange}
				renderItem={
					pickerState.activeTrigger
						? pickerState.activeTrigger.renderItem
						: (item: AutocompleteItem, isSelected: boolean) => (
								<Box paddingLeft={2}>
									<Text color={isSelected ? "cyan" : undefined}>{item.key}</Text>
								</Box>
							)
				}
				emptyMessage={pickerState.activeTrigger?.emptyMessage}
				isActive={isInputAreaActive && pickerState.isOpen}
				isLoading={pickerState.isLoading}
			/>
		</Box>
	)
}
