import React, { useCallback, useEffect, useState } from "react"

import type { OpenAiCodexRateLimitInfo } from "@jabberwock/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { rootStore } from "@src/features/store"

import {
	formatTimeRemainingMs,
	formatWindowLabel,
	formatPlanLabel,
	getUsageStatusLabel,
} from "./OpenAICodexRateLimitDashboard.helpers"

interface OpenAICodexRateLimitDashboardProps {
	isAuthenticated: boolean
}

type Translate = (key: string, options?: Record<string, unknown>) => string

const UsageProgressBar: React.FC<{ usedPercent: number; label?: string }> = ({ usedPercent, label }) => {
	const percentage = Math.max(0, Math.min(100, usedPercent))
	const isWarning = percentage >= 70
	const isCritical = percentage >= 90

	return (
		<div className="w-full">
			{label ? <div className="text-xs text-vscode-descriptionForeground mb-1">{label}</div> : null}
			<div className="w-full bg-vscode-input-background rounded-sm h-2 overflow-hidden">
				<div
					className={`h-full transition-all duration-300 ${
						isCritical
							? "bg-vscode-errorForeground"
							: isWarning
								? "bg-vscode-editorWarning-foreground"
								: "bg-vscode-button-background"
					}`}
					style={{ width: `${percentage}%` }}
				/>
			</div>
		</div>
	)
}

interface UsageRowProps {
	windowLabel: string | undefined
	used: number | undefined
	timeRemaining: string
	resetsAt: number | undefined
	usedPercent: number
	label?: string
	t: Translate
}

const UsageRow: React.FC<UsageRowProps> = ({ windowLabel, used, timeRemaining, resetsAt, usedPercent, label, t }) => (
	<div className="space-y-1">
		<div className="flex items-center justify-between text-xs">
			<span className="text-vscode-foreground">
				{windowLabel ?? t("settings:providers.openAiCodexRateLimits.window.usage")}
			</span>
			<span className="text-vscode-descriptionForeground">
				{getUsageStatusLabel(used, timeRemaining, resetsAt, t)}
			</span>
		</div>
		<UsageProgressBar usedPercent={usedPercent} label={label} />
	</div>
)

export const OpenAICodexRateLimitDashboard: React.FC<OpenAICodexRateLimitDashboardProps> = ({ isAuthenticated }) => {
	const { t } = useAppTranslation()
	const [rateLimits, setRateLimits] = useState<OpenAiCodexRateLimitInfo | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const fetchRateLimits = useCallback(() => {
		if (!isAuthenticated) {
			setRateLimits(null)
			setError(null)
			return
		}
		setIsLoading(true)
		setError(null)
		rootStore.settings.requestOpenaiCodexRateLimits()
	}, [isAuthenticated])

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "openAiCodexRateLimits") {
				setIsLoading(false)
				if (message.error) {
					setError(message.error)
					setRateLimits(null)
				} else if (message.values) {
					setRateLimits(message.values)
					setError(null)
				}
			}
		}
		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	useEffect(() => {
		if (isAuthenticated) {
			fetchRateLimits()
		}
	}, [isAuthenticated, fetchRateLimits])

	if (!isAuthenticated) return null

	if (isLoading && !rateLimits) {
		return (
			<div className="bg-vscode-editor-background border border-vscode-panel-border rounded-md p-3">
				<div className="text-sm text-vscode-descriptionForeground">
					{t("settings:providers.openAiCodexRateLimits.loading")}
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="bg-vscode-editor-background border border-vscode-panel-border rounded-md p-3">
				<div className="flex items-center justify-between">
					<div className="text-sm text-vscode-errorForeground">
						{t("settings:providers.openAiCodexRateLimits.loadError")}
					</div>
					<button
						onClick={fetchRateLimits}
						className="text-xs text-vscode-textLink-foreground hover:text-vscode-textLink-activeForeground cursor-pointer bg-transparent border-none">
						{t("settings:providers.openAiCodexRateLimits.retry")}
					</button>
				</div>
				<div className="mt-2 text-xs text-vscode-descriptionForeground break-words">{error}</div>
			</div>
		)
	}

	if (!rateLimits) return null

	const primary = rateLimits.primary
	const secondary = rateLimits.secondary
	const planType = rateLimits.planType
	const planLabel = formatPlanLabel(planType, t)

	return (
		<div className="bg-vscode-editor-background border border-vscode-panel-border rounded-md p-3">
			<div className="mb-3">
				<div className="text-sm font-medium text-vscode-foreground">
					{t("settings:providers.openAiCodexRateLimits.title", { planLabel })}
				</div>
			</div>

			<div className="space-y-3">
				{primary && (
					<UsageRow
						windowLabel={formatWindowLabel(primary.windowMinutes, t)}
						used={Math.round(primary.usedPercent)}
						timeRemaining={primary.resetsAt ? formatTimeRemainingMs(primary.resetsAt - Date.now(), t) : ""}
						resetsAt={primary.resetsAt}
						usedPercent={primary.usedPercent}
						t={t}
					/>
				)}

				{secondary && (
					<UsageRow
						windowLabel={formatWindowLabel(secondary.windowMinutes, t)}
						used={Math.round(secondary.usedPercent)}
						timeRemaining={
							secondary.resetsAt ? formatTimeRemainingMs(secondary.resetsAt - Date.now(), t) : ""
						}
						resetsAt={secondary.resetsAt}
						usedPercent={secondary.usedPercent}
						t={t}
					/>
				)}
			</div>
		</div>
	)
}
