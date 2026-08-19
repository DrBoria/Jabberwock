import React, { useCallback } from "react"
import { observer } from "mobx-react-lite"
import { Activity, Cloud } from "lucide-react"
import { Trans } from "react-i18next"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { rootStore } from "@src/features/store"
import { useChatUI } from "@src/features/chat/store"
import { Container } from "@src/shared/ui/layouts/Container"
import JabberwockHero from "@src/features/chat/extension-state/components/JabberwockHero"
import JabberwockTips from "@src/features/chat/extension-state/components/JabberwockTips"
import HistoryPreview from "@src/features/history/components/HistoryPreview"
import VersionIndicator from "@src/features/foundation/components/ui/display/VersionIndicator"
import DismissibleUpsell from "@src/features/foundation/components/ui/display/DismissibleUpsell"
import { ChatTextArea } from "@sections/dndTextArea/view"

export interface HomeScreenProps {
	openUpsell: () => void
}

/**
 * Landing page shown when no task is active.
 * Displays JabberwockHero, tips, history preview, and DevTools toggle.
 */
const HomeScreenComponent: React.FC<HomeScreenProps> = ({ openUpsell }) => {
	const { t } = useAppTranslation()
	const ui = useChatUI()
	const { devtoolEnabled, taskHistory, cloudIsAuthenticated } = rootStore.extensionState

	const handleSend = useCallback(() => {
		const text = ui.textArea.inputValue.trim()
		const images = ui.textArea.selectedImages.slice()
		if (text || images.length > 0) {
			const goals = ui.textArea.pendingGoals.slice()
			ui.textArea.clearPendingGoals()
			rootStore.chat.sendMessage(text, images, goals)
		}
	}, [ui])

	const handleSelectImages = React.useCallback(() => {
		rootStore.chat.selectImages()
	}, [])

	return (
		<Container className="flex flex-col h-full justify-center p-6 min-h-0 overflow-y-auto gap-4 relative">
			<Container className="flex flex-col items-start gap-2 justify-center h-full min-[400px]:px-6">
				<Container className="absolute top-2 right-3 z-10 flex gap-2 items-center">
					<button
						onClick={() => rootStore.settings.toggleDevtool()}
						className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors cursor-pointer border-none font-sans text-[11px] font-semibold ${
							devtoolEnabled
								? "bg-vscode-button-hoverBackground text-[#ffaa00]"
								: "bg-vscode-badge-background text-vscode-badge-foreground opacity-70 hover:opacity-100"
						}`}
						title="Toggle DevTools">
						<Activity size={12} />
						DevTools
					</button>
					<VersionIndicator onClick={() => rootStore.chat.setShowAnnouncementModal(true)} />
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
					goals={ui.textArea.pendingGoals}
					onAddGoal={ui.textArea.addPendingGoal}
					onRemoveGoal={ui.textArea.removePendingGoal}
				/>
			</Container>
		</Container>
	)
}

export const HomeScreen = observer(HomeScreenComponent)
