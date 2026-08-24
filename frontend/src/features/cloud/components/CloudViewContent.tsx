import { VSCodeProgressRing, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import type { CloudUserInfo, CloudOrganizationMembership } from "@jabberwock/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { ToggleSwitch } from "@src/shared/ui/buttons/toggle-switch"
import { renderCloudBenefitsContent } from "./CloudUpsellDialog"
import { ArrowRight, Info, Lock, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@src/shared/ui/buttons/button"
import { OrganizationSwitcher } from "./OrganizationSwitcher"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"

const getInitial = (userInfo: CloudUserInfo): string => {
	const n = userInfo.name?.charAt(0)
	return n || userInfo.email?.charAt(0) || "?"
}

interface AuthenticatedContentProps {
	userInfo: CloudUserInfo
	organizations: CloudOrganizationMembership[]
	cloudApiUrl?: string
	taskSyncEnabled: boolean
	onTaskSyncToggle: () => void
	onLogoutClick: () => void
	onVisitCloudWebsite: () => void
}

export const AuthenticatedContent = ({
	userInfo,
	organizations,
	cloudApiUrl,
	taskSyncEnabled,
	onTaskSyncToggle,
	onLogoutClick,
	onVisitCloudWebsite,
}: AuthenticatedContentProps) => {
	const { t } = useAppTranslation()
	return (
		<>
			<div className="flex flex-col items-start ml-4 mb-6">
				<div className="w-16 h-16 mb-3 rounded-full overflow-hidden">
					{userInfo.picture ? (
						<img
							src={userInfo.picture}
							alt={t("cloud:profilePicture")}
							className="w-full h-full object-cover"
						/>
					) : (
						<div className="w-full h-full flex items-center justify-center bg-vscode-button-background text-vscode-button-foreground text-xl">
							{getInitial(userInfo)}
						</div>
					)}
				</div>
				{userInfo.name && <h2 className="text-lg font-medium text-vscode-foreground my-0">{userInfo.name}</h2>}
				{userInfo.email && <p className="text-sm text-vscode-descriptionForeground my-0">{userInfo.email}</p>}
				<div className="w-full max-w-60 mt-4">
					<OrganizationSwitcher userInfo={userInfo} organizations={organizations} cloudApiUrl={cloudApiUrl} />
				</div>
			</div>
			<div className="mt-4 p-4 border-b border-t border-vscode-widget-border pl-4 max-w-140">
				<div className="flex items-center gap-3 mb-2">
					<ToggleSwitch
						checked={taskSyncEnabled}
						onChange={onTaskSyncToggle}
						size="medium"
						aria-label={t("cloud:taskSync")}
						data-testid="task-sync-toggle"
						disabled={!!userInfo.organizationId}
					/>
					<span className="font-medium text-vscode-foreground flex items-center">
						{t("cloud:taskSync")}
						{userInfo.organizationId && (
							<StandardTooltip content={t("cloud:taskSyncManagedByOrganization")}>
								<div className="bg-vscode-badge-background text-vscode-badge-foreground/80 p-1.5 ml-2 -mb-2 relative -top-1 rounded-full inline-block cursor-help">
									<Lock className="size-3 block" />
								</div>
							</StandardTooltip>
						)}
					</span>
				</div>
				<div className="text-vscode-descriptionForeground text-sm mt-1 ml-8">
					{t("cloud:taskSyncDescription")}
				</div>
			</div>
			<div className="text-vscode-descriptionForeground text-sm mt-4 mb-8 pl-4">
				<Info className="inline size-3 mr-1 mb-0.5 text-vscode-descriptionForeground" />
				{t("cloud:usageMetricsAlwaysReported")}
			</div>
			<div className="flex flex-col gap-2 mt-4 pl-4">
				<Button variant="secondary" onClick={onVisitCloudWebsite} className="w-full max-w-80">
					{t("cloud:visitCloudWebsite")}
				</Button>
				<Button variant="secondary" onClick={onLogoutClick} className="w-full max-w-80">
					{t("cloud:logOut")}
				</Button>
			</div>
		</>
	)
}

interface UnauthenticatedContentProps {
	authInProgress: boolean
	showManualEntry: boolean
	manualUrl: string
	onConnectClick: () => void
	onShowManualEntry: () => void
	onReset: () => void
	onManualUrlChange: (e: Event | React.FormEvent<HTMLElement>) => void
	onKeyDown: (e: Event | React.FormEvent<HTMLElement>) => void
	manualUrlRef: (element: unknown) => void
}

export const UnauthenticatedContent = ({
	authInProgress,
	showManualEntry,
	manualUrl,
	onConnectClick,
	onShowManualEntry,
	onReset,
	onManualUrlChange,
	onKeyDown,
	manualUrlRef,
}: UnauthenticatedContentProps) => {
	const { t } = useAppTranslation()
	return (
		<div className="flex flex-col items-start gap-4 px-4 max-w-lg">
			<div className={cn(authInProgress && "opacity-50")}>{renderCloudBenefitsContent(t)}</div>
			{!authInProgress && (
				<Button variant="primary" onClick={onConnectClick}>
					{t("cloud:connect")}
					<ArrowRight />
				</Button>
			)}
			{authInProgress && !showManualEntry && (
				<div className="flex flex-col items-start gap-1">
					<div className="flex items-center gap-2 text-base text-vscode-descriptionForeground">
						<VSCodeProgressRing className="size-3 text-vscode-foreground" />
						{t("cloud:authWaiting")}
					</div>
					{!showManualEntry && (
						<button
							onClick={onShowManualEntry}
							className="text-base ml-5 text-vscode-textLink-foreground hover:text-vscode-textLink-activeForeground underline cursor-pointer bg-transparent border-none p-0">
							{t("cloud:havingTrouble")}
						</button>
					)}
				</div>
			)}
			{showManualEntry && (
				<div className="space-y-2 max-w-72">
					<p className="text-base text-vscode-descriptionForeground">{t("cloud:pasteCallbackUrl")}</p>
					<VSCodeTextField
						ref={manualUrlRef}
						value={manualUrl}
						onChange={onManualUrlChange}
						onKeyDown={onKeyDown}
						placeholder="vscode://RooVeterinaryInc.jabberwock/auth/clerk/callback?state=..."
						className="w-full"
					/>
					<p className="mt-1">
						or{" "}
						<button
							onClick={onReset}
							className="text-base text-vscode-textLink-foreground hover:text-vscode-textLink-activeForeground underline cursor-pointer bg-transparent border-none p-0">
							{t("cloud:startOver")}
						</button>
					</p>
				</div>
			)}
		</div>
	)
}

interface CloudUrlPillProps {
	cloudApiUrl?: string
	onOpenCloudUrl: () => void
}

export const CloudUrlPill = ({ cloudApiUrl, onOpenCloudUrl }: CloudUrlPillProps) => {
	const { t } = useAppTranslation()
	if (!cloudApiUrl || cloudApiUrl === "https://app.jabberwock.com") return null
	return (
		<div className="ml-4 mt-6 flex">
			<div className="inline-flex items-center gap-2 text-xs">
				<TriangleAlert className="size-3 text-vscode-descriptionForeground" />
				<span className="text-vscode-foreground/75">{t("cloud:cloudUrlPillLabel")} </span>
				<button
					onClick={onOpenCloudUrl}
					className="text-vscode-textLink-foreground hover:text-vscode-textLink-activeForeground underline cursor-pointer bg-transparent border-none p-0">
					{cloudApiUrl}
				</button>
			</div>
		</div>
	)
}
