import { useCallback, useEffect, useRef, useState } from "react"
import {
	VSCodeLink,
	VSCodeProgressRing,
	VSCodeRadio,
	VSCodeRadioGroup,
	VSCodeTextField,
} from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@jabberwock/types"
import {
	CLOUD_CLEAR_CLOUD_AUTH_SKIP_MODEL as _CLOUD_CLEAR_CLOUD_AUTH_SKIP_MODEL,
	CLOUD_JABBERWOCK_CLOUD_SIGN_IN as _CLOUD_JABBERWOCK_CLOUD_SIGN_IN,
	AGENT_STATE_UPSERT_API_CONFIGURATION as _AGENT_STATE_UPSERT_API_CONFIGURATION,
	CLOUD_JABBERWOCK_CLOUD_MANUAL_URL as _CLOUD_JABBERWOCK_CLOUD_MANUAL_URL,
	HISTORY_IMPORT_SETTINGS as _HISTORY_IMPORT_SETTINGS,
} from "@jabberwock/types"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { validateApiConfiguration } from "@src/utils/validate"
import { rootStore } from "@src/features/store"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "../ui/button"

import ApiOptions from "../settings/ApiOptions"
import { Tab, TabContent } from "../common/Tab"

import JabberwockHero from "./JabberwockHero"
import { Trans } from "react-i18next"
import { ArrowLeft, ArrowRight, BadgeInfo, Brain, TriangleAlert } from "lucide-react"
import { buildDocLink } from "@/features/settings/utils/docLinks"

type ProviderOption = "jabberwock" | "custom"
type AuthOrigin = "landing" | "providerSelection"

const WelcomeViewProvider = () => {
	const {
		apiConfiguration,
		currentApiConfigName,
		setApiConfiguration,
		setShowWelcome,
		uriScheme,
		cloudIsAuthenticated,
		cloudAuthSkipModel,
	} = useExtensionState()
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

	// When auth completes during the provider signup flow, either:
	// 1. If user skipped model selection (cloudAuthSkipModel=true), navigate to provider selection with "custom" selected
	// 2. Otherwise, save the Jabberwock config and navigate to chat
	useEffect(() => {
		if (cloudIsAuthenticated && authInProgress) {
			if (cloudAuthSkipModel) {
				// User skipped model selection during signup - navigate to provider selection with 3rd-party selected
				setSelectedProvider("custom")
				setAuthInProgress(false)
				setShowManualEntry(false)
				// Clear the flag so it doesn't affect future flows
				rootStore.cloud.clearAuthSkipModel()
			} else {
				// Auth completed from provider signup flow - save the config now
				const rooConfig: ProviderSettings = {
					apiProvider: "jabberwock",
				}
				rootStore.settings.upsertApiConfig(currentApiConfigName, rooConfig)
				setAuthInProgress(false)
				setShowManualEntry(false)
				setShowWelcome(false)
			}
		}
	}, [cloudIsAuthenticated, authInProgress, currentApiConfigName, cloudAuthSkipModel, setShowWelcome])

	// Focus the manual URL input when it becomes visible
	useEffect(() => {
		if (showManualEntry && manualUrlInputRef.current) {
			setTimeout(() => {
				manualUrlInputRef.current?.focus()
			}, 50)
		}
	}, [showManualEntry])

	// Memoize the setApiConfigurationField function to pass to ApiOptions
	const setApiConfigurationFieldForApiOptions = useCallback(
		<K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) => {
			setApiConfiguration({ [field]: value })
		},
		[setApiConfiguration], // setApiConfiguration from context is stable
	)

	const handleGetStarted = useCallback(() => {
		console.log(
			"[handleGetStarted] entered, selectedProvider:",
			selectedProvider,
			"cloudIsAuthenticated:",
			cloudIsAuthenticated,
		)
		console.log(
			"[handleGetStarted] apiConfiguration keys:",
			Object.keys(apiConfiguration || {}),
			"apiProvider:",
			apiConfiguration?.apiProvider,
		)

		// Landing screen - always trigger auth with Jabberwock
		if (selectedProvider === null) {
			console.log("[handleGetStarted] branch: LANDING screen - triggering Jabberwock auth")
			setAuthOrigin("landing")
			rootStore.cloud.cloudSignIn(true)
			setAuthInProgress(true)
			console.log("[handleGetStarted] LANDING: auth initiated, authInProgress set to true")
		}
		// Provider Selection screen
		else if (selectedProvider === "jabberwock") {
			console.log("[handleGetStarted] branch: JABBERWOCK provider selected")
			if (cloudIsAuthenticated) {
				console.log("[handleGetStarted] JABBERWOCK: already authenticated, saving config and finishing")
				// Already authenticated - save config and finish
				const rooConfig: ProviderSettings = {
					apiProvider: "jabberwock",
				}
				console.log("[handleGetStarted] JABBERWOCK: upserting config, apiConfigName:", currentApiConfigName)
				rootStore.settings.upsertApiConfig(currentApiConfigName, rooConfig)
				console.log("[handleGetStarted] JABBERWOCK: hiding welcome screen")
				setShowWelcome(false)
			} else {
				console.log("[handleGetStarted] JABBERWOCK: not authenticated, triggering auth flow")
				// Need to authenticate
				setAuthOrigin("providerSelection")
				rootStore.cloud.cloudSignIn(true)
				setAuthInProgress(true)
				console.log("[handleGetStarted] JABBERWOCK: auth initiated from providerSelection origin")
			}
		} else {
			console.log("[handleGetStarted] branch: CUSTOM provider selected")
			console.log(
				"[handleGetStarted] CUSTOM: apiConfiguration keys:",
				Object.keys(apiConfiguration || {}),
				"has apiProvider:",
				!!apiConfiguration?.apiProvider,
			)

			// Custom provider - validate first
			if (!apiConfiguration || !apiConfiguration.apiProvider) {
				console.log(
					"[handleGetStarted] CUSTOM: MISSING apiProvider - blocking navigation, showing error. Full apiConfiguration:",
					JSON.stringify(apiConfiguration),
				)
				setErrorMessage(t("welcome:providerSignup.selectProvider"))
				return
			}

			const error = validateApiConfiguration(apiConfiguration)
			console.log(
				"[handleGetStarted] CUSTOM: apiProvider:",
				apiConfiguration.apiProvider,
				"validation error:",
				error,
			)

			if (error) {
				console.log("[handleGetStarted] CUSTOM: validation FAILED, setting error message:", error)
				setErrorMessage(error)
				return
			}

			console.log(
				"[handleGetStarted] CUSTOM: validation passed, upserting config:",
				JSON.stringify(apiConfiguration),
			)
			setErrorMessage(undefined)
			rootStore.settings.upsertApiConfig(currentApiConfigName, apiConfiguration)
			setShowWelcome(false)
		}
		console.log("[handleGetStarted] finished")
	}, [selectedProvider, cloudIsAuthenticated, apiConfiguration, currentApiConfigName, setShowWelcome, t])

	const handleNoAccount = useCallback(() => {
		// Navigate to Provider Selection, defaulting to Jabberwock option
		setSelectedProvider("jabberwock")
	}, [])

	const handleBackToLanding = useCallback(() => {
		// Return to the landing screen
		setSelectedProvider(null)
		setErrorMessage(undefined)
	}, [])

	const handleGoBack = useCallback(() => {
		setAuthInProgress(false)
		setShowManualEntry(false)
		setManualUrl("")
		setManualErrorMessage(false)

		// Return to the appropriate screen based on origin
		if (authOrigin === "providerSelection") {
			// Keep selectedProvider as-is, user returns to Provider Selection
		} else {
			// Return to Landing
			setSelectedProvider(null)
		}
		setAuthOrigin(null)
	}, [authOrigin])

	const handleManualUrlChange = (e: React.KeyboardEvent<HTMLElement>) => {
		const url = (e.target as HTMLInputElement).value
		setManualUrl(url)

		// Auto-trigger authentication when a complete URL is pasted
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
		} else {
			setManualErrorMessage(true)
		}
	}, [manualUrl])

	const handleOpenSignupUrl = () => {
		rootStore.cloud.cloudSignIn(false)
	}

	// Render the waiting for cloud state
	if (authInProgress) {
		return (
			<Tab>
				<TabContent className="flex flex-col gap-4 p-6 justify-center">
					<div className="flex flex-col items-start gap-4 pt-8">
						<VSCodeProgressRing className="size-6" />
						<h2 className="my-0 text-xl font-semibold">{t("welcome:waitingForCloud.heading")}</h2>
						<p className="text-vscode-descriptionForeground mt-0">
							{t("welcome:waitingForCloud.description")}
						</p>

						<div className="flex gap-2 items-start pr-4 text-vscode-descriptionForeground">
							<BadgeInfo className="size-4 inline shrink-0" />
							<p className="m-0">
								<Trans
									i18nKey="welcome:waitingForCloud.noPrompt"
									components={{
										clickHere: (
											<button
												onClick={handleOpenSignupUrl}
												className="text-vscode-textLink-foreground hover:text-vscode-textLink-activeForeground underline cursor-pointer bg-transparent border-none p-0"
											/>
										),
									}}
								/>
							</p>
						</div>

						<div className="flex gap-2 items-start pr-4 text-vscode-descriptionForeground">
							<TriangleAlert className="size-4 inline shrink-0" />
							<div>
								{!showManualEntry ? (
									<p className="m-0">
										<Trans
											i18nKey="welcome:waitingForCloud.havingTrouble"
											components={{
												clickHere: (
													<button
														onClick={() => setShowManualEntry(true)}
														className="text-vscode-textLink-foreground hover:text-vscode-textLink-activeForeground underline cursor-pointer bg-transparent border-none p-0	"
													/>
												),
											}}
										/>
									</p>
								) : (
									<div className="w-full max-w-sm">
										<p className="text-vscode-descriptionForeground mt-0">
											{t("welcome:waitingForCloud.pasteUrl")}
										</p>
										<div className="flex gap-2 items-center">
											<VSCodeTextField
												ref={handleManualUrlRef}
												value={manualUrl}
												onKeyUp={handleManualUrlChange}
												placeholder="vscode://RooVeterinaryInc.jabberwock/auth/clerk/callback?state=..."
												className="flex-1"
											/>
											<Button
												onClick={handleSubmit}
												disabled={manualUrl.length < 40}
												variant="secondary">
												<ArrowRight className="size-4" />
											</Button>
										</div>
										<p className="mt-2">
											<Trans
												i18nKey="welcome:waitingForCloud.docsLink"
												components={{
													DocsLink: (
														<a
															href={buildDocLink("jabberwock-cloud/login", "setup")}
															target="_blank"
															rel="noopener noreferrer"
															className="text-vscode-textLink-foreground hover:underline">
															{t("common:docsLink.label")}
														</a>
													),
												}}
											/>
										</p>
										{manualUrl && manualErrorMessage && (
											<p className="text-vscode-errorForeground mt-2">
												{t("welcome:waitingForCloud.invalidURL")}
											</p>
										)}
									</div>
								)}
							</div>
						</div>
					</div>

					<div className="mt-4">
						<Button onClick={handleGoBack} variant="secondary">
							<ArrowLeft className="size-4" />
							{t("welcome:waitingForCloud.goBack")}
						</Button>
					</div>
				</TabContent>
			</Tab>
		)
	}

	// Landing screen - shown when selectedProvider === null
	if (selectedProvider === null) {
		return (
			<Tab>
				<TabContent className="relative flex flex-col gap-4 p-6 justify-center">
					<JabberwockHero />
					<h2 className="mt-0 mb-0 text-xl">{t("welcome:landing.greeting")}</h2>

					<div className="space-y-4 leading-normal">
						<p className="text-base text-vscode-foreground">
							<Trans i18nKey="welcome:landing.introduction" />
						</p>
						<p className="mb-0 font-semibold">
							<Trans i18nKey="welcome:landing.accountMention" />
						</p>
					</div>

					<div className="mt-2 flex gap-2 items-center">
						<Button onClick={handleGetStarted} variant="primary">
							{t("welcome:landing.getStarted")}
						</Button>
						<VSCodeLink onClick={handleNoAccount} className="cursor-pointer">
							{t("welcome:landing.noAccount")}
						</VSCodeLink>
					</div>

					<div className="absolute bottom-6 left-6">
						<button
							onClick={() => rootStore.history.importSettings()}
							className="cursor-pointer bg-transparent border-none p-0 text-vscode-foreground hover:underline">
							{t("welcome:importSettings")}
						</button>
					</div>
				</TabContent>
			</Tab>
		)
	}

	// Provider Selection screen - shown when selectedProvider is "jabberwock" or "custom"
	return (
		<Tab>
			<TabContent className="flex flex-col gap-4 p-6 justify-center">
				<Brain className="size-8" strokeWidth={1.5} />
				<h2 className="mt-0 mb-0 text-xl">{t("welcome:providerSignup.heading")}</h2>

				<p className="text-base text-vscode-foreground">
					<Trans i18nKey="welcome:providerSignup.chooseProvider" />
				</p>

				<div>
					<VSCodeRadioGroup
						value={selectedProvider}
						onChange={(e: Event | React.FormEvent<HTMLElement>) => {
							const target = ((e as CustomEvent)?.detail?.target ||
								(e.target as HTMLInputElement)) as HTMLInputElement
							setSelectedProvider(target.value as ProviderOption)
						}}>
						{/* Jabberwock Router Option */}
						<VSCodeRadio value="jabberwock" className="flex items-start gap-2">
							<div className="flex-1 space-y-1 cursor-pointer">
								<p className="text-lg font-semibold block -mt-1">
									{t("welcome:providerSignup.jabberwockCloudProvider")}
								</p>
								<p className="text-base text-vscode-descriptionForeground mt-0">
									{t("welcome:providerSignup.jabberwockCloudDescription")}{" "}
									<VSCodeLink
										href="https://jabberwock.com/provider/pricing?utm_source=extension&utm_medium=welcome-screen&utm_campaign=provider-signup&utm_content=learn-more"
										className="cursor-pointer">
										{t("welcome:providerSignup.learnMore")}
									</VSCodeLink>
								</p>
							</div>
						</VSCodeRadio>

						{/* Use Another Provider Option */}
						<VSCodeRadio value="custom" className="flex items-start gap-2">
							<div className="flex-1 space-y-1 cursor-pointer">
								<p className="text-lg font-semibold block -mt-1">
									{t("welcome:providerSignup.useAnotherProvider")}
								</p>
								<p className="text-base text-vscode-descriptionForeground mt-0">
									{t("welcome:providerSignup.useAnotherProviderDescription")}
								</p>
							</div>
						</VSCodeRadio>
					</VSCodeRadioGroup>

					{/* Expand API options only when custom provider is selected, max height is used to force a transition */}
					<div className="mb-8 border-l-2 border-vscode-panel-border pl-6 ml-[7px]">
						<div
							className={`overflow-clip transition-[max-height] ease-in-out duration-300 ${selectedProvider === "custom" ? "max-h-[600px]" : "max-h-0"}`}>
							<ApiOptions
								fromWelcomeView
								apiConfiguration={apiConfiguration || {}}
								uriScheme={uriScheme}
								setApiConfigurationField={setApiConfigurationFieldForApiOptions}
								errorMessage={errorMessage}
								setErrorMessage={setErrorMessage}
							/>
						</div>
					</div>
				</div>

				<div className="-mt-4 flex gap-2">
					<Button onClick={handleBackToLanding} variant="secondary">
						<ArrowLeft className="size-4" />
						{t("welcome:providerSignup.goBack")}
					</Button>
					<Button onClick={handleGetStarted} variant="primary">
						{t("welcome:providerSignup.finish")} →
					</Button>
				</div>
			</TabContent>
		</Tab>
	)
}

export default WelcomeViewProvider
