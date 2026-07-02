import { useEffect, useState } from "react"

/**
 * Hook that synchronizes input value with history browsing state.
 * When user starts browsing history, shows the history value.
 * When user exits browsing, restores the draft value.
 */
export function useHistorySync(
	isBrowsing: boolean,
	historyValue: string | null,
	draft: string,
	inputValue: string,
	setInputValue: (value: string) => void,
): void {
	const [wasBrowsing, setWasBrowsing] = useState(false)

	useEffect(() => {
		if (isBrowsing && !wasBrowsing) {
			if (historyValue !== null) {
				setInputValue(historyValue)
			}
		} else if (!isBrowsing && wasBrowsing) {
			setInputValue(draft)
		} else if (isBrowsing && historyValue !== null && historyValue !== inputValue) {
			setInputValue(historyValue)
		}

		setWasBrowsing(isBrowsing)
	}, [isBrowsing, wasBrowsing, historyValue, draft, inputValue, setInputValue])
}
