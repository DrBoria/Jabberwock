import { useState, useCallback, useRef, useEffect } from "react"
import { TelemetryEventName } from "@jabberwock/types"
import { rootStore } from "@src/features/store"
import { telemetryClient } from "@/features/cloud/utils/TelemetryClient"

interface UseCloudUpsellOptions {
	onAuthSuccess?: () => void
	autoOpenOnAuth?: boolean
}

export const useCloudUpsell = (options: UseCloudUpsellOptions = {}) => {
	const { onAuthSuccess, autoOpenOnAuth = false } = options
	const [isOpen, setIsOpen] = useState(false)
	const [shouldOpenOnAuth, setShouldOpenOnAuth] = useState(false)
	const cloud = rootStore.cloud
	const cloudIsAuthenticated = cloud.cloudIsAuthenticated
	const sharingEnabled = cloud.sharingEnabled
	const publicSharingEnabled = cloud.publicSharingEnabled
	const wasUnauthenticatedRef = useRef(false)
	const initiatedAuthRef = useRef(false)

	// Track authentication state changes
	useEffect(() => {
		if (!cloudIsAuthenticated || !sharingEnabled) {
			wasUnauthenticatedRef.current = true
		} else if (wasUnauthenticatedRef.current && cloudIsAuthenticated && sharingEnabled) {
			// User just authenticated
			if (initiatedAuthRef.current) {
				// Auth was initiated from this hook
				telemetryClient.capture(TelemetryEventName.ACCOUNT_CONNECT_SUCCESS)
				setIsOpen(false) // Close the upsell dialog

				if (autoOpenOnAuth && shouldOpenOnAuth) {
					onAuthSuccess?.()
					setShouldOpenOnAuth(false)
				}

				initiatedAuthRef.current = false // Reset the flag
			}
			wasUnauthenticatedRef.current = false
		}
	}, [cloudIsAuthenticated, sharingEnabled, onAuthSuccess, autoOpenOnAuth, shouldOpenOnAuth])

	const openUpsell = useCallback(() => {
		setIsOpen(true)
	}, [])

	const closeUpsell = useCallback(() => {
		setIsOpen(false)
		setShouldOpenOnAuth(false)
	}, [])

	const handleConnect = useCallback(() => {
		// Mark that authentication was initiated from this hook
		initiatedAuthRef.current = true
		setShouldOpenOnAuth(true)

		// Send message to VS Code to initiate sign in
		rootStore.cloud.cloudSignIn()

		// Close the upsell dialog
		closeUpsell()
	}, [closeUpsell])

	return {
		isOpen,
		openUpsell,
		closeUpsell,
		handleConnect,
		isAuthenticated: cloudIsAuthenticated,
		sharingEnabled,
		publicSharingEnabled,
	}
}
