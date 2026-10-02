/**
 * Shared input-event handlers for the profile create/rename forms:
 * value extraction from the (untyped) input event, and the Enter/Escape
 * keydown contract (Enter saves when non-empty, Escape cancels).
 */

/** Build an onInput handler that reports the new value and clears the error. */
export const makeConfigInputHandler = (onValue: (value: string) => void, onClearError: () => void) => (e: unknown) => {
	const target = e as { target: { value: string } }
	onValue(target.target.value)
	onClearError()
}

/** Build an onKeyDown handler: Enter saves (when non-empty), Escape cancels. */
export const makeConfigKeydownHandler = (value: string, onSave: () => void, onCancel: () => void) => (e: unknown) => {
	const event = e as { key: string }
	if (event.key === "Enter" && value.trim()) onSave()
	else if (event.key === "Escape") onCancel()
}
