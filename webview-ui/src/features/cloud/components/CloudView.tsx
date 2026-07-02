import { useCallback, useEffect, useRef, useState } from "react"

import { type CloudUserInfo, type CloudOrganizationMembership, TelemetryEventName } from "@jabberwock/types"

import { rootStore } from "@src/features/store"
import { telemetryClient } from "@src/features/cloud/utils/TelemetryClient"
import { Tab, TabContent } from "@src/features/foundation/components/ui/layout/Tab"
import { AuthenticatedContent, UnauthenticatedContent, CloudUrlPill } from "./CloudViewContent"

const PRODUCTION_JABBERWOCK_CODE_API_URL = "https://app.jabberwock.com"

type CloudViewProps = {
	userInfo: CloudUserInfo | null
	isAuthenticated: boolean
	cloudApiUrl?: string
	organizations?: CloudOrganizationMembership[]
}

export const CloudView = ({ userInfo, isAuthenticated, cloudApiUrl, organizations = [] }: CloudViewProps) => {
	const taskSyncEnabled = rootStore.extensionState.taskSyncEnabled
	const setTaskSyncEnabled = (value: boolean) => rootStore.setTaskSyncEnabled(value)
	const wasAuthenticatedRef = useRef(false)
	const timeoutRef = useRef<NodeJS.Timeout | null>(null)
	const manualUrlInputRef = useRef<HTMLElement | null>(null)
	const handleManualUrlRef = useCallback((element: unknown) => {
		manualUrlInputRef.current = element instanceof HTMLElement ? element : null
	}, [])
	const [authInProgress, setAuthInProgress] = useState(false)
	const [showManualEntry, setShowManualEntry] = useState(false)
	const [manualUrl, setManualUrl] = useState("")

	useEffect(() => {
		if (isAuthenticated) {
			wasAuthenticatedRef.current = true
			setAuthInProgress(false)
			setShowManualEntry(false)
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
				timeoutRef.current = null
			}
		} else if (wasAuthenticatedRef.current && !isAuthenticated) {
			telemetryClient.capture(TelemetryEventName.ACCOUNT_LOGOUT_SUCCESS)
			wasAuthenticatedRef.current = false
		}
	}, [isAuthenticated])

	useEffect(() => {
		if (showManualEntry && manualUrlInputRef.current) setTimeout(() => manualUrlInputRef.current?.focus(), 50)
	}, [showManualEntry])

	useEffect(
		() => () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current)
		},
		[],
	)

	const handleConnectClick = (): void => {
		telemetryClient.capture(TelemetryEventName.ACCOUNT_CONNECT_CLICKED)
		rootStore.cloud.cloudSignIn()
		setAuthInProgress(true)
	}

	const handleManualUrlChange = (e: Event | React.FormEvent<HTMLElement>): void => {
		const target = e.target as HTMLInputElement | null
		const url = target?.value ?? ""
		setManualUrl(url)
		setTimeout(() => {
			if (url.trim() && url.includes("://") && url.includes("/auth/clerk/callback"))
				rootStore.cloud.cloudManualUrl(url.trim())
		}, 100)
	}

	const handleKeyDown = (e: Event | React.FormEvent<HTMLElement>): void => {
		const keyboardEvent = e as KeyboardEvent
		if (keyboardEvent.key === "Enter") {
			const url = manualUrl.trim()
			if (url && url.includes("://") && url.includes("/auth/clerk/callback")) rootStore.cloud.cloudManualUrl(url)
		}
	}

	const handleShowManualEntry = (): void => {
		setShowManualEntry(true)
	}
	const handleReset = (): void => {
		setAuthInProgress(false)
		setShowManualEntry(false)
		setManualUrl("")
	}

	const handleLogoutClick = (): void => {
		telemetryClient.capture(TelemetryEventName.ACCOUNT_LOGOUT_CLICKED)
		rootStore.cloud.cloudSignOut()
	}

	const handleVisitCloudWebsite = (): void => {
		telemetryClient.capture(TelemetryEventName.ACCOUNT_CONNECT_CLICKED)
		rootStore.settings.openExternal(cloudApiUrl || PRODUCTION_JABBERWOCK_CODE_API_URL)
	}

	const handleOpenCloudUrl = (): void => {
		if (cloudApiUrl) rootStore.settings.openExternal(cloudApiUrl)
	}

	const handleTaskSyncToggle = (): void => {
		const newValue = !taskSyncEnabled
		setTaskSyncEnabled(newValue)
		rootStore.cloud.taskSyncEnabled(newValue)
	}

	return (
		<Tab>
			<TabContent className="pt-10">
				{isAuthenticated && userInfo ? (
					<AuthenticatedContent
						userInfo={userInfo}
						organizations={organizations}
						cloudApiUrl={cloudApiUrl}
						taskSyncEnabled={taskSyncEnabled}
						onTaskSyncToggle={handleTaskSyncToggle}
						onLogoutClick={handleLogoutClick}
						onVisitCloudWebsite={handleVisitCloudWebsite}
					/>
				) : (
					<UnauthenticatedContent
						authInProgress={authInProgress}
						showManualEntry={showManualEntry}
						manualUrl={manualUrl}
						onConnectClick={handleConnectClick}
						onShowManualEntry={handleShowManualEntry}
						onReset={handleReset}
						onManualUrlChange={handleManualUrlChange}
						onKeyDown={handleKeyDown}
						manualUrlRef={handleManualUrlRef}
					/>
				)}
				<CloudUrlPill cloudApiUrl={cloudApiUrl} onOpenCloudUrl={handleOpenCloudUrl} />
			</TabContent>
		</Tab>
	)
}
