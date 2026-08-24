/**
 * Extracts a text value from an event, handling both VSCode design system
 * CustomEvent (detail.target.value) and standard DOM Event (target.value).
 */
import React from "react"

export function getEventValue(e: Event | React.FormEvent<HTMLElement>): string | undefined {
	// Handle CustomEvent from VSCode design system components
	if ("detail" in e) {
		const detail = (e as CustomEvent).detail
		const value = detail?.target?.value
		if (typeof value === "string") {
			return value
		}
	}
	// Handle standard DOM Event
	const target = e.target
	if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
		return target.value
	}
	return undefined
}
