import React from "react"
import { observer } from "mobx-react-lite"
import { Activity, Cloud } from "lucide-react"
import { Trans } from "react-i18next"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useChatUI } from "@src/context/ChatUIContext"
import { Container } from "@src/components/ui/Container"
import JabberwockHero from "@src/components/welcome/JabberwockHero"
import JabberwockTips from "@src/components/welcome/JabberwockTips"
import HistoryPreview from "@src/components/history/HistoryPreview"
import VersionIndicator from "../../common/VersionIndicator"
import DismissibleUpsell from "../../common/DismissibleUpsell"
import { ChatTextArea } from "../ChatTextArea"

export interface HomeScreenProps {
	devtoolEnabled: boolean
	taskHistory: any[]
	cloudIsAuthenticated: boolean
	showAnnouncementModal: boolean
	setShowAnnouncementModal: (v: boolean) => void
	openUpsell: () => void
}

/**
 * Landing page shown when no task is active.
 * Displays JabberwockHero, tips, history preview, and DevTools toggle.
 */
const HomeScreenComponent: React.FC<HomeScreenProps> = ({
	devtoolEnabled,
	taskHistory,
	cloudIsAuthenticated,
	setShowAnnouncementModal,
	openUpsell,
}) => {
	const { t } = useAppTranslation()
	const ui = useChatUI()

	const handleSend = React.useCallback(() => {
		const text = ui.inputValue.trim()
		const images = ui.selectedImages.slice()
		if (text || images.length > 0) {
			vscode.postMessage({ type: "newTask", text, images })
			ui.clearInput()
		}
	}, [ui])

	const handleSelectImages = React.useCallback(() => {
		vscode.postMessage({ type: "selectImages" })
	}, [])

	return (
		<Container className="flex flex-col h-full justify-center p-6 min-h-0 overflow-y-auto gap-4 relative">
			<Container className="flex flex-col items-start gap-2 justify-center h-full min-[400px]:px-6">
				<Container className="absolute top-2 right-3 z-10 flex gap-2 items-center">
					<button
						onClick={() => vscode.postMessage({ type: "devtoolStatus", text: "toggle" })}
						className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors cursor-pointer border-none font-sans text-[11px] font-semibold ${
							devtoolEnabled
								? "bg-vscode-button-hoverBackground text-[#ffaa00]"
								: "bg-vscode-badge-background text-vscode-badge-foreground opacity-70 hover:opacity-100"
						}`}
						title="Toggle DevTools">
						<Activity size={12} />
						DevTools
					</button>
					<VersionIndicator onClick={() => setShowAnnouncementModal(true)} />
				</Container>
				<Container className="flex flex-col gap-4 w-full">
					<JabberwockHero />
					{taskHistory.length < 6 && <JabberwockTips />}
					{taskHistory.length > 0 && <HistoryPreview />}
				</Container>
				{!cloudIsAuthenticated && taskHistory.length >= 6 && (
					<DismissibleUpsell
						upsellId="taskList2"
						icon={<Cloud className="size-5 shrink-0" />}
						onClick={() => openUpsell()}
						dismissOnClick={false}
						className="bg-none mt-6 border-border rounded-xl p-3 !text-base">
						<Trans
							i18nKey="cloud:upsell.taskList"
							components={{ learnMoreLink: <VSCodeLink href="#" /> }}
						/>
					</DismissibleUpsell>
				)}
			</Container>
			<Container className="flex-shrink-0">
				<ChatTextArea
					placeholderText={t("chat:placeholder")}
					onSend={handleSend}
					onSelectImages={handleSelectImages}
					shouldDisableImages={false}
					modeShortcutText=""
				/>
			</Container>
		</Container>
	)
}

export const HomeScreen = observer(HomeScreenComponent)
