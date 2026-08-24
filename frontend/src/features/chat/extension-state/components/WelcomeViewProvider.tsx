import { useCallback, useEffect, useRef, useState } from "react"
import type { ProviderSettings } from "@jabberwock/types"
import {
	CLOUD_CLEAR_CLOUD_AUTH_SKIP_MODEL as _CLOUD_CLEAR_CLOUD_AUTH_SKIP_MODEL,
	CLOUD_JABBERWOCK_CLOUD_SIGN_IN as _CLOUD_JABBERWOCK_CLOUD_SIGN_IN,
	CLOUD_JABBERWOCK_CLOUD_MANUAL_URL as _CLOUD_JABBERWOCK_CLOUD_MANUAL_URL,
} from "@jabberwock/types"
import { observer } from "mobx-react-lite"
import { rootStore } from "@src/features/store"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import {
	AuthInProgressView,
	LandingView,
	saveJabberwockConfig,
	validateAndSaveCustomConfig,
} from "./welcome-view-views"
import { ProviderSelectionView } from "./welcome-view-provider-selection"

type ProviderOption = "jabberwock" | "custom"
type AuthOrigin = "landing" | "providerSelection"

function triggerJabberwockAuth(
	setAuthOrigin: (v: AuthOrigin) => void,
	setAuthInProgress: (v: boolean) => void,
	origin: AuthOrigin,
) {
	setAuthOrigin(origin)
	rootStore.cloud.cloudSignIn(true)
	setAuthInProgress(true)
}

const WelcomeViewProvider = observer(() => {
	const s = rootStore.extensionState
	const cloud = rootStore.cloud
	const apiConfiguration = s.apiConfiguration
	const currentApiConfigName = s.currentApiConfigName
	const setApiConfiguration = useCallback((config: ProviderSettings) => rootStore.setApiConfiguration(config), [])
	const setShowWelcome = useCallback((value: boolean) => rootStore.setShowWelcome(value), [])
	const uriScheme = s.uriScheme
	const cloudIsAuthenticated = cloud.cloudIsAuthenticated
	const cloudAuthSkipModel = s.cloudAuthSkipModel
	const { t } = useAppTranslation()
	const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)
	const [selectedProvider, setSelectedProvider] = useState<ProviderOption | null>(null)
	const [authInProgress, setAuthInProgress] = useState(false)
	const [authOrigin, setAuthOrigin] = useState<AuthOrigin | null>(null)
	const [showManualEntry, setShowManualEntry] = useState(false)
	const [manualUrl, setManualUrl] = useState("")
	const [manualErrorMessage, setManualErrorMessage] = useState<boolean | undefined>(undefined)
	const manualUrlInputRef = useRef<HTMLElement | null>(null)
	const handleManualUrlRef = useCallback((element: unknown) => {
		manualUrlInputRef.current = element instanceof HTMLElement ? element : null
	}, [])

	useEffect(() => {
		if (cloudIsAuthenticated && authInProgress) {
			if (cloudAuthSkipModel) {
				setSelectedProvider("custom")
				setAuthInProgress(false)
				setShowManualEntry(false)
				rootStore.cloud.clearAuthSkipModel()
			} else {
				saveJabberwockConfig(currentApiConfigName)
				setAuthInProgress(false)
				setShowManualEntry(false)
				setShowWelcome(false)
			}
		}
	}, [cloudIsAuthenticated, authInProgress, currentApiConfigName, cloudAuthSkipModel, setShowWelcome])

	useEffect(() => {
		if (showManualEntry && manualUrlInputRef.current) setTimeout(() => manualUrlInputRef.current?.focus(), 50)
	}, [showManualEntry])

	const setApiConfigurationFieldForApiOptions = useCallback(
		<K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) =>
			setApiConfiguration({ [field]: value }),
		[setApiConfiguration],
	)

	const handleGetStarted = useCallback(() => {
		if (selectedProvider === null) triggerJabberwockAuth(setAuthOrigin, setAuthInProgress, "landing")
		else if (selectedProvider === "jabberwock") {
			if (cloudIsAuthenticated) {
				saveJabberwockConfig(currentApiConfigName)
				setShowWelcome(false)
			} else triggerJabberwockAuth(setAuthOrigin, setAuthInProgress, "providerSelection")
		} else validateAndSaveCustomConfig(apiConfiguration, currentApiConfigName, setErrorMessage, setShowWelcome, t)
	}, [selectedProvider, cloudIsAuthenticated, apiConfiguration, currentApiConfigName, setShowWelcome, t])

	const handleNoAccount = useCallback(() => setSelectedProvider("jabberwock"), [])
	const handleBackToLanding = useCallback(() => {
		setSelectedProvider(null)
		setErrorMessage(undefined)
	}, [])
	const handleGoBack = useCallback(() => {
		setAuthInProgress(false)
		setShowManualEntry(false)
		setManualUrl("")
		setManualErrorMessage(false)
		if (authOrigin !== "providerSelection") setSelectedProvider(null)
		setAuthOrigin(null)
	}, [authOrigin])
	const handleManualUrlChange = (e: React.KeyboardEvent<HTMLElement>) => {
		const url = (e.target as HTMLInputElement).value
		setManualUrl(url)
		setTimeout(() => {
			if (url.trim() && url.includes("://") && url.includes("/auth/clerk/callback")) {
				setManualErrorMessage(false)
				rootStore.cloud.cloudManualUrl(url.trim())
			}
		}, 100)
	}
	const handleSubmit = useCallback(() => {
		const url = manualUrl.trim()
		if (url && url.includes("://") && url.includes("/auth/clerk/callback")) {
			setManualErrorMessage(false)
			rootStore.cloud.cloudManualUrl(url)
		} else setManualErrorMessage(true)
	}, [manualUrl])
	const handleOpenSignupUrl = () => rootStore.cloud.cloudSignIn(false)

	if (authInProgress)
		return (
			<AuthInProgressView
				t={t}
				showManualEntry={showManualEntry}
				setShowManualEntry={setShowManualEntry}
				manualUrl={manualUrl}
				handleManualUrlChange={handleManualUrlChange}
				handleSubmit={handleSubmit}
				handleManualUrlRef={handleManualUrlRef}
				manualErrorMessage={manualErrorMessage}
				handleOpenSignupUrl={handleOpenSignupUrl}
				handleGoBack={handleGoBack}
			/>
		)
	if (selectedProvider === null)
		return <LandingView t={t} handleGetStarted={handleGetStarted} handleNoAccount={handleNoAccount} />

	return (
		<ProviderSelectionView
			t={t}
			selectedProvider={selectedProvider}
			setSelectedProvider={setSelectedProvider}
			apiConfiguration={apiConfiguration}
			uriScheme={uriScheme}
			setApiConfigurationField={setApiConfigurationFieldForApiOptions}
			errorMessage={errorMessage}
			setErrorMessage={setErrorMessage}
			handleBackToLanding={handleBackToLanding}
			handleGetStarted={handleGetStarted}
		/>
	)
})

export default WelcomeViewProvider
