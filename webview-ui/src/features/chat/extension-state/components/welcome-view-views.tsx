import { VSCodeLink, VSCodeProgressRing, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import type { ProviderSettings } from "@jabberwock/types"
import { Button } from "@src/shared/ui/buttons/button"
import { Tab, TabContent } from "@src/features/foundation/components/ui/layout/Tab"
import { rootStore } from "@src/features/store"
import { validateApiConfiguration } from "@src/utils/helpers/validate"
import JabberwockHero from "./JabberwockHero"
import { Trans } from "react-i18next"
import { ArrowLeft, ArrowRight, BadgeInfo, TriangleAlert } from "lucide-react"
import { buildDocLink } from "@/utils/misc/docLinks"

export function saveJabberwockConfig(currentApiConfigName: string | undefined) {
	rootStore.settings.upsertApiConfig(currentApiConfigName ?? "default", { apiProvider: "jabberwock" })
}

export function validateAndSaveCustomConfig(
	apiConfiguration: ProviderSettings | null | undefined,
	currentApiConfigName: string | undefined,
	setErrorMessage: (v: string | undefined) => void,
	setShowWelcome: (v: boolean) => void,
	t: (key: string) => string,
): boolean {
	if (!apiConfiguration || !apiConfiguration.apiProvider) {
		setErrorMessage(t("welcome:providerSignup.selectProvider"))
		return false
	}
	const error = validateApiConfiguration(apiConfiguration)
	if (error) {
		setErrorMessage(error)
		return false
	}
	setErrorMessage(undefined)
	rootStore.settings.upsertApiConfig(currentApiConfigName ?? "default", apiConfiguration)
	setShowWelcome(false)
	return true
}

interface AuthInProgressViewProps {
	t: (key: string, options?: Record<string, unknown>) => string
	showManualEntry: boolean
	setShowManualEntry: (v: boolean) => void
	manualUrl: string
	handleManualUrlChange: (e: React.KeyboardEvent<HTMLElement>) => void
	handleSubmit: () => void
	handleManualUrlRef: (element: unknown) => void
	manualErrorMessage: boolean | undefined
	handleOpenSignupUrl: () => void
	handleGoBack: () => void
}

export const AuthInProgressView: React.FC<AuthInProgressViewProps> = ({
	t,
	showManualEntry,
	setShowManualEntry,
	manualUrl,
	handleManualUrlChange,
	handleSubmit,
	handleManualUrlRef,
	manualErrorMessage,
	handleOpenSignupUrl,
	handleGoBack,
}) => (
	<Tab>
		<TabContent className="flex flex-col gap-4 p-6 justify-center">
			<div className="flex flex-col items-start gap-4 pt-8">
				<VSCodeProgressRing className="size-6" />
				<h2 className="my-0 text-xl font-semibold">{t("welcome:waitingForCloud.heading")}</h2>
				<p className="text-vscode-descriptionForeground mt-0">{t("welcome:waitingForCloud.description")}</p>
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
												className="text-vscode-textLink-foreground hover:text-vscode-textLink-activeForeground underline cursor-pointer bg-transparent border-none p-0"
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
									<Button onClick={handleSubmit} disabled={manualUrl.length < 40} variant="secondary">
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
				<div className="mt-4">
					<Button onClick={handleGoBack} variant="secondary">
						<ArrowLeft className="size-4" />
						{t("welcome:waitingForCloud.goBack")}
					</Button>
				</div>
			</div>
		</TabContent>
	</Tab>
)

interface LandingViewProps {
	t: (key: string, options?: Record<string, unknown>) => string
	handleGetStarted: () => void
	handleNoAccount: () => void
}

export const LandingView: React.FC<LandingViewProps> = ({ t, handleGetStarted, handleNoAccount }) => (
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
