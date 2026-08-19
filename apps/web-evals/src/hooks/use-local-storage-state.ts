"use client"

import { useCallback, useEffect, useState } from "react"

export function useLocalStorageState<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
	const [state, setState] = useState<T>(() => {
		if (typeof window === "undefined") return defaultValue
		try {
			const stored = localStorage.getItem(key)
			return stored ? JSON.parse(stored) : defaultValue
		} catch {
			return defaultValue
		}
	})

	useEffect(() => {
		localStorage.setItem(key, JSON.stringify(state))
	}, [key, state])

	const setValue = useCallback(
		(value: T | ((prev: T) => T)) => {
			if (typeof value === "function") {
				setState((prev) => {
					const next = (value as (prev: T) => T)(prev)
					localStorage.setItem(key, JSON.stringify(next))
					return next
				})
			} else {
				setState(value as T)
			}
		},
		[key],
	)

	return [state, setValue]
}

export function useStringLocalStorageState(key: string, defaultValue: string): [string, (value: string) => void] {
	const [state, setState] = useState<string>(() => {
		if (typeof window === "undefined") return defaultValue
		return localStorage.getItem(key) || defaultValue
	})

	useEffect(() => {
		localStorage.setItem(key, state)
	}, [key, state])

	return [state, setState]
}
