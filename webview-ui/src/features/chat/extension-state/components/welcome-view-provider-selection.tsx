import { VSCodeLink, VSCodeRadio, VSCodeRadioGroup } from "@vscode/webview-ui-toolkit/react"
import type { ProviderSettings } from "@jabberwock/types"
import { Button } from "@src/shared/ui/buttons/button"
import { Tab, TabContent } from "@src/features/foundation/components/ui/layout/Tab"
import ApiOptions from "@src/features/settings/components/ApiOptions/components/ApiOptions"
import { Trans } from "react-i18next"
import { ArrowLeft, Brain } from "lucide-react"

import type React from "react"
type ProviderOption = "jabberwock" | "custom"

interface ProviderSelectionViewProps {
	t: (key: string, options?: Record<string, unknown>) => string
	selectedProvider: ProviderOption
	setSelectedProvider: (v: ProviderOption) => void
	apiConfiguration: ProviderSettings | null | undefined
	uriScheme: string | undefined
	setApiConfigurationField: <K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) => void
	errorMessage: string | undefined
	setErrorMessage: React.Dispatch<React.SetStateAction<string | undefined>>
	handleBackToLanding: () => void
	handleGetStarted: () => void
}

export const ProviderSelectionView: React.FC<ProviderSelectionViewProps> = ({
	t,
	selectedProvider,
	setSelectedProvider,
	apiConfiguration,
	uriScheme,
	setApiConfigurationField,
	errorMessage,
	setErrorMessage,
	handleBackToLanding,
	handleGetStarted,
}) => (
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
				<div className="mb-8 border-l-2 border-vscode-panel-border pl-6 ml-[7px]">
					<div
						className={`overflow-clip transition-[max-height] ease-in-out duration-300 ${selectedProvider === "custom" ? "max-h-[600px]" : "max-h-0"}`}>
						<ApiOptions
							fromWelcomeView
							apiConfiguration={apiConfiguration || {}}
							uriScheme={uriScheme}
							setApiConfigurationField={setApiConfigurationField}
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
