/**
 * TerminalSizeContext - Provides terminal dimensions via React Context
 * This ensures only one instance of useTerminalSize exists in the app
 * Uses a MobX observable for the size value to integrate with the MobX ecosystem.
 */

import { createContext, useContext, ReactNode, useEffect } from "react"
import { useLocalObservable } from "mobx-react-lite"
import { useTerminalSize as useTerminalSizeHook } from "./useTerminalSize.js"

interface TerminalSizeContextValue {
	columns: number
	rows: number
}

const TerminalSizeContext = createContext<TerminalSizeContextValue | null>(null)

interface TerminalSizeProviderProps {
	children: ReactNode
}

/**
 * Provider component that wraps the app and provides terminal size to all children.
 * Uses a MobX observable for the size value so that consumer components
 * wrapped with observer() get reactive updates.
 */
export function TerminalSizeProvider({ children }: TerminalSizeProviderProps) {
	const size = useLocalObservable(() => ({
		columns: process.stdout.columns || 80,
		rows: process.stdout.rows || 24,
	}))

	const { columns, rows } = useTerminalSizeHook()

	useEffect(() => {
		size.columns = columns
		size.rows = rows
	}, [columns, rows, size])

	return <TerminalSizeContext.Provider value={size}>{children}</TerminalSizeContext.Provider>
}

/**
 * Hook to access terminal size from context
 * Must be used within a TerminalSizeProvider
 */
export function useTerminalSize(): TerminalSizeContextValue {
	const context = useContext(TerminalSizeContext)
	if (!context) {
		throw new Error("useTerminalSize must be used within a TerminalSizeProvider")
	}
	return context
}
