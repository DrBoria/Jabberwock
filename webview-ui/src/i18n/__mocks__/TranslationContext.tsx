import React from "react"

/**
 * Mock TranslationProvider for tests.
 * Wraps children without any actual translation logic.
 */
export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	return <>{children}</>
}
