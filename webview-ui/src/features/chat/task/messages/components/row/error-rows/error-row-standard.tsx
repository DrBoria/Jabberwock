import React, { useState, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { BookOpenText, MessageCircleWarning, Copy, Check, Microscope, Info } from "lucide-react"

import { useCopyToClipboard } from "@sections/dndTextArea/utils/clipboard/clipboard"
import { rootStore } from "@src/features/store"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@src/shared/ui/overlays/dialog"
import { Button } from "@src/shared/ui/buttons/button"

export const ErrorRowStandard: React.FC<{
	errorTitle: string | null
	message: string
	messageClassName?: string
	headerClassName?: string
	docsURL?: string
	additionalContent?: React.ReactNode
	errorDetails?: string
	version: string
	provider: string
	modelId: string
	usesProxy: boolean
}> = ({
	errorTitle,
	message,
	messageClassName,
	headerClassName,
	docsURL,
	additionalContent,
	errorDetails,
	version,
	provider,
	modelId,
	usesProxy,
}) => {
	const { t } = useTranslation()
	const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
	const [showDetailsCopySuccess, setShowDetailsCopySuccess] = useState(false)
	const { copyWithFeedback } = useCopyToClipboard()

	const formattedErrorDetails = useMemo(() => {
		if (!errorDetails) return undefined
		const metadata = [
			`Date/time: ${new Date().toISOString()}`,
			`Extension version: ${version}`,
			`Provider: ${provider}${usesProxy ? " (proxy)" : ""}`,
			`Model: ${modelId}`,
			"",
			"",
		].join("\n")
		return metadata + errorDetails
	}, [errorDetails, version, provider, modelId, usesProxy])

	const handleCopyDetails = useCallback(
		async (e: React.MouseEvent) => {
			e.stopPropagation()
			if (formattedErrorDetails) {
				const success = await copyWithFeedback(formattedErrorDetails)
				if (success) {
					setShowDetailsCopySuccess(true)
					setTimeout(() => setShowDetailsCopySuccess(false), 1000)
				}
			}
		},
		[formattedErrorDetails, copyWithFeedback],
	)

	const handleDownloadDiagnostics = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			rootStore.settings.downloadErrorDiagnostics({
				timestamp: new Date().toISOString(),
				version,
				provider,
				model: modelId,
				details: errorDetails || "",
			})
		},
		[version, provider, modelId, errorDetails],
	)

	return (
		<>
			<div className="group pr-2">
				{errorTitle && (
					<div className={headerClassName || "flex items-center justify-between gap-2 break-words"}>
						<MessageCircleWarning className="w-4 text-vscode-errorForeground" />
						<span className="font-bold grow cursor-default">{errorTitle}</span>
						<div className="flex items-center gap-2">
							{docsURL && (
								<a
									href={docsURL}
									className="text-sm flex items-center gap-1 transition-opacity opacity-0 group-hover:opacity-100"
									onClick={(e) => {
										e.preventDefault()
										if (docsURL.startsWith("jabberwock://settings"))
											rootStore.windowManager.switchTab("settings", { section: "providers" })
										else rootStore.settings.openExternal(docsURL)
									}}>
									<BookOpenText className="size-3 mt-[3px]" />
									{docsURL.startsWith("jabberwock://settings")
										? t("chat:apiRequest.errorMessage.goToSettings", { defaultValue: "Settings" })
										: t("chat:apiRequest.errorMessage.docs")}
								</a>
							)}
						</div>
					</div>
				)}
				<div className="ml-2 pl-4 mt-1 pt-0.5 border-l border-vscode-errorForeground/50">
					<p
						className={
							messageClassName ||
							"cursor-default my-0 font-light whitespace-pre-wrap break-words text-vscode-descriptionForeground"
						}>
						{message}
						{formattedErrorDetails && (
							<button
								onClick={() => setIsDetailsDialogOpen(true)}
								className="cursor-pointer ml-1 text-vscode-descriptionForeground/50 hover:text-vscode-descriptionForeground hover:underline font-normal"
								aria-label={t("chat:errorDetails.title")}>
								{t("chat:errorDetails.link")}
							</button>
						)}
					</p>
					{additionalContent}
				</div>
			</div>

			{formattedErrorDetails && (
				<Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
					<DialogContent className="max-w-2xl">
						<DialogHeader>
							<DialogTitle>{t("chat:errorDetails.title")}</DialogTitle>
						</DialogHeader>
						<div className="max-h-96 overflow-auto bg-vscode-editor-background rounded-xl border border-vscode-editorGroup-border">
							<pre className="font-mono text-sm whitespace-pre-wrap break-words bg-transparent px-3">
								{formattedErrorDetails}
							</pre>
							{usesProxy && (
								<div className="cursor-default flex gap-2 border-t-1 px-3 py-2 border-vscode-editorGroup-border bg-foreground/5 text-vscode-button-secondaryForeground">
									<Info className="size-3 shrink-0 mt-1 text-vscode-descriptionForeground" />
									<span className="text-vscode-descriptionForeground text-sm">
										{t("chat:errorDetails.proxyProvider")}
									</span>
								</div>
							)}
						</div>
						<DialogFooter>
							<Button variant="secondary" className="w-full" onClick={handleCopyDetails}>
								{showDetailsCopySuccess ? (
									<>
										<Check className="size-3" />
										{t("chat:errorDetails.copied")}
									</>
								) : (
									<>
										<Copy className="size-3" />
										{t("chat:errorDetails.copyToClipboard")}
									</>
								)}
							</Button>
							<Button variant="secondary" className="w-full" onClick={handleDownloadDiagnostics}>
								<Microscope className="size-3" />
								{t("chat:errorDetails.diagnostics")}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}
		</>
	)
}
