/**
 * TerminalSizeProvider - Tracks terminal dimensions and publishes them to the
 * MobX uiStateStore so consumer components wrapped with observer() get
 * reactive updates. State lives in the sanctioned MobX store (uiStateStore),
 * not in React Context.
 */

import { ReactNode, useEffect } from "react"
import { useTerminalSize as useTerminalSizeHook } from "./size.js"
import { uiStateStore } from "../store.js"

export interface TerminalSizeContextValue {
	columns: number
	rows: number
}

interface TerminalSizeProviderProps {
	children: ReactNode
}

/**
 * Provider component that wraps the app and keeps the terminal size in the
 * uiStateStore for all children.
 */
export function TerminalSizeProvider({ children }: TerminalSizeProviderProps) {
	const { columns, rows } = useTerminalSizeHook()

	useEffect(() => {
		uiStateStore.setTerminalSize({ columns, rows })
	}, [columns, rows])

	return <>{children}</>
}

/**
 * Hook to access terminal size from the uiStateStore.
 * Must be used within a TerminalSizeProvider.
 */
export function useTerminalSize(): TerminalSizeContextValue {
	return uiStateStore.terminalSize
}
