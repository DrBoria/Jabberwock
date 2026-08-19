import { Checkbox } from "vscrui"
import type { ReasoningToggleCheckboxProps } from "../types"

export const ReasoningToggleCheckbox = ({
	enableReasoningEffort,
	required,
	onChange,
	label,
}: ReasoningToggleCheckboxProps) =>
	required ? null : (
		<div className="flex flex-col gap-1">
			<Checkbox checked={enableReasoningEffort} onChange={onChange}>
				{label}
			</Checkbox>
		</div>
	)
