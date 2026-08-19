import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Share2Icon } from "lucide-react"

import { type HistoryItem, type ShareVisibility, TelemetryEventName } from "@jabberwock/types"

import { rootStore } from "@src/features/store"
import { telemetryClient } from "@/features/cloud/utils/TelemetryClient"
import { observer } from "mobx-react-lite"
import { useCloudUpsell } from "@/hooks/useCloudUpsell"
import { CloudUpsellDialog } from "@/features/cloud/components/CloudUpsellDialog"
import { Popover, PopoverTrigger } from "@src/shared/ui/overlays/popover"
import { SharePopoverContent } from "./share-popover-content"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import { IconButton } from "@src/shared/ui/buttons/icon-button"

interface ShareButtonProps {
	item?: HistoryItem
	disabled?: boolean
}

export const ShareButton = observer(({ item, disabled = false }: ShareButtonProps) => {
	const [shareDropdownOpen, setShareDropdownOpen] = useState(false)
	const [shareSuccess, setShareSuccess] = useState<{ visibility: ShareVisibility; url: string } | null>(null)
	const [wasConnectInitiatedFromShare, setWasConnectInitiatedFromShare] = useState(false)
	const { t } = useTranslation()
	const cloudUserInfo = rootStore.extensionState.cloudUserInfo

	// Use enhanced cloud upsell hook with auto-open on auth success
	const {
		isOpen: connectModalOpen,
		openUpsell,
		closeUpsell,
		handleConnect,
		isAuthenticated: cloudIsAuthenticated,
		sharingEnabled,
		publicSharingEnabled,
	} = useCloudUpsell({
		onAuthSuccess: () => {
			// Auto-open share dropdown after successful authentication
			setShareDropdownOpen(true)
			setWasConnectInitiatedFromShare(false)
		},
	})

	// Auto-open popover when user becomes authenticated after clicking Connect from share button
	useEffect(() => {
		if (wasConnectInitiatedFromShare && cloudIsAuthenticated) {
			setShareDropdownOpen(true)
			setWasConnectInitiatedFromShare(false)
		}
	}, [wasConnectInitiatedFromShare, cloudIsAuthenticated])

	// Listen for share success messages from the extension
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "shareTaskSuccess") {
				setShareSuccess({
					visibility: message.visibility,
					url: message.text,
				})
				// Auto-hide success message and close popover after 5 seconds
				setTimeout(() => {
					setShareSuccess(null)
					setShareDropdownOpen(false)
				}, 5000)
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	const handleShare = (visibility: ShareVisibility) => {
		// Clear any previous success state
		setShareSuccess(null)

		// Send telemetry for share action
		if (visibility === "organization") {
			telemetryClient.capture(TelemetryEventName.SHARE_ORGANIZATION_CLICKED)
		} else {
			telemetryClient.capture(TelemetryEventName.SHARE_PUBLIC_CLICKED)
		}

		rootStore.windowManager.shareCurrentTask(visibility)
		// Don't close the dropdown immediately - let success message show first
	}

	const handleConnectToCloud = () => {
		setWasConnectInitiatedFromShare(true)
		handleConnect()
		setShareDropdownOpen(false)
	}

	const handleShareButtonClick = () => {
		// Send telemetry for share button click
		telemetryClient.capture(TelemetryEventName.SHARE_BUTTON_CLICKED)

		if (!cloudIsAuthenticated) {
			// Show modal for unauthenticated users
			openUpsell()
			telemetryClient.capture(TelemetryEventName.SHARE_CONNECT_TO_CLOUD_CLICKED)
		} else {
			// Show popover for authenticated users
			setShareDropdownOpen(true)
		}
	}

	// Determine share button state
	const getShareButtonState = () => {
		if (!cloudIsAuthenticated) {
			return {
				disabled: false,
				title: t("chat:task.share"),
				showPopover: false, // We'll show modal instead
			}
		} else if (!sharingEnabled) {
			return {
				disabled: true,
				title: t("chat:task.sharingDisabledByOrganization"),
				showPopover: false,
			}
		} else {
			return {
				disabled: false,
				title: t("chat:task.share"),
				showPopover: true,
			}
		}
	}

	const shareButtonState = getShareButtonState()

	// Don't render if no item ID
	if (!item?.id) {
		return null
	}

	const disabledWithState = disabled || shareButtonState.disabled

	return (
		<>
			{shareButtonState.showPopover ? (
				<Popover open={shareDropdownOpen} onOpenChange={setShareDropdownOpen}>
					<StandardTooltip content={shareButtonState.title}>
						<PopoverTrigger asChild>
							<IconButton
								icon={Share2Icon}
								disabled={disabledWithState}
								tooltip={false}
								onClick={handleShareButtonClick}
								data-testid="share-button"
								title={t("chat:task.share")}></IconButton>
						</PopoverTrigger>
					</StandardTooltip>

					<SharePopoverContent
						shareSuccess={shareSuccess}
						t={t}
						cloudUserInfo={cloudUserInfo}
						handleShare={handleShare}
						publicSharingEnabled={publicSharingEnabled}
					/>
				</Popover>
			) : (
				<IconButton
					icon={Share2Icon}
					disabled={disabledWithState}
					title={shareButtonState.title}
					onClick={handleShareButtonClick}
					data-testid="share-button"></IconButton>
			)}

			{/* Connect to Cloud Modal */}
			<CloudUpsellDialog open={connectModalOpen} onOpenChange={closeUpsell} onConnect={handleConnectToCloud} />
		</>
	)
})
