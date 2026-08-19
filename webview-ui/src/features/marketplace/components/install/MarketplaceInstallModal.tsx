import React, { useState, useMemo, useEffect } from "react"
import { MarketplaceItem, McpParameter, McpInstallationMethod } from "@jabberwock/types"
import { rootStore } from "@src/features/store"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@src/shared/ui/overlays/dialog"
import { SuccessContent } from "./MarketplaceInstallSuccessContent"
import { InstallConfigContent } from "./MarketplaceInstallConfigContent"
import { DialogFooterContent } from "./MarketplaceDialogFooterContent"

interface MarketplaceInstallModalProps {
	item: MarketplaceItem | null
	isOpen: boolean
	onClose: () => void
	hasWorkspace: boolean
}

export const MarketplaceInstallModal: React.FC<MarketplaceInstallModalProps> = ({
	item,
	isOpen,
	onClose,
	hasWorkspace,
}) => {
	const { t } = useAppTranslation()
	const [scope, setScope] = useState<"project" | "global">(hasWorkspace ? "project" : "global")
	const [selectedMethodIndex, setSelectedMethodIndex] = useState(0)
	const [parameterValues, setParameterValues] = useState<Record<string, string>>({})
	const [validationError, setValidationError] = useState<string | null>(null)
	const [installationComplete, setInstallationComplete] = useState(false)
	React.useEffect(() => {
		if (item) {
			setSelectedMethodIndex(0)
			setParameterValues({})
			setValidationError(null)
			setInstallationComplete(false)
		}
	}, [item])
	const hasMultipleMethods = useMemo(() => !!(item && Array.isArray(item.content) && item.content.length > 1), [item])
	const methodNames = useMemo(() => {
		if (!item || !Array.isArray(item.content)) return []
		return (item.content as Array<{ name: string; content: string }>).map((method) => method.name)
	}, [item])
	const effectiveParameters = useMemo(() => {
		if (!item) return []
		const globalParams = item.type === "mcp" ? item.parameters || [] : []
		let methodParams: McpParameter[] = []
		if (Array.isArray(item.content)) {
			const selectedMethod = item.content[selectedMethodIndex] as McpInstallationMethod
			methodParams = selectedMethod?.parameters || []
		}
		const paramMap = new Map<string, McpParameter>()
		globalParams.forEach((p) => paramMap.set(p.key, p))
		methodParams.forEach((p) => paramMap.set(p.key, p))
		return Array.from(paramMap.values())
	}, [item, selectedMethodIndex])
	const effectivePrerequisites = useMemo(() => {
		if (!item) return []
		const globalPrereqs = item.prerequisites || []
		let methodPrereqs: string[] = []
		if (Array.isArray(item.content)) {
			const selectedMethod = item.content[selectedMethodIndex] as McpInstallationMethod
			methodPrereqs = selectedMethod?.prerequisites || []
		}
		return Array.from(new Set([...globalPrereqs, ...methodPrereqs]))
	}, [item, selectedMethodIndex])
	React.useEffect(() => {
		if (item) {
			const globalParams = item.type === "mcp" ? item.parameters || [] : []
			let methodParams: McpParameter[] = []
			if (Array.isArray(item.content)) {
				const selectedMethod = item.content[selectedMethodIndex] as McpInstallationMethod
				methodParams = selectedMethod?.parameters || []
			}
			const paramMap = new Map<string, McpParameter>()
			globalParams.forEach((p) => paramMap.set(p.key, p))
			methodParams.forEach((p) => paramMap.set(p.key, p))
			setParameterValues((prev) => {
				const newValues: Record<string, string> = {}
				Array.from(paramMap.values()).forEach((param) => {
					newValues[param.key] = prev[param.key] || ""
				})
				return newValues
			})
		}
	}, [item, selectedMethodIndex])
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "marketplaceInstallResult" && message.slug === item?.id) {
				if (message.success) {
					setInstallationComplete(true)
					setValidationError(null)
					rootStore.marketplace.fetchMarketplaceData()
				} else {
					setValidationError(message.error || "Installation failed")
					setInstallationComplete(false)
				}
			}
		}
		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [item?.id])
	const handleInstall = () => {
		if (!item) return
		setValidationError(null)
		for (const param of effectiveParameters) {
			if (!param.optional && !parameterValues[param.key]?.trim()) {
				setValidationError(t("marketplace:install.validationRequired", { paramName: param.name }))
				return
			}
		}
		const finalParameters: Record<string, string> = { ...parameterValues }
		for (const param of effectiveParameters) {
			if (param.optional && !finalParameters[param.key]) finalParameters[param.key] = ""
		}
		rootStore.marketplace.installMarketplaceItem(item, { target: scope, parameters: { ...finalParameters } })
		setValidationError(null)
	}
	const handlePostInstallAction = (tab: "mcp" | "modes") => {
		rootStore.windowManager.switchTab("settings", { section: tab })
		onClose()
	}
	if (!item) return null
	const isMcp = item.type === "mcp"
	const hasUrl = isMcp && !!item.url
	const dialogTitle = installationComplete
		? t("marketplace:install.successTitle", { name: item.name })
		: isMcp
			? t("marketplace:install.titleMcp", { name: item.name })
			: t("marketplace:install.titleMode", { name: item.name })
	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>{dialogTitle}</DialogTitle>
					{!installationComplete && hasUrl && (
						<DialogDescription>
							<a
								href={item.url}
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary hover:underline inline-flex items-center gap-1">
								{t("marketplace:install.moreInfoMcp", { name: item.name })}
							</a>
						</DialogDescription>
					)}
				</DialogHeader>
				{installationComplete ? (
					<SuccessContent item={item} t={t} />
				) : (
					<InstallConfigContent
						scope={scope}
						setScope={setScope}
						hasWorkspace={hasWorkspace}
						hasMultipleMethods={hasMultipleMethods}
						selectedMethodIndex={selectedMethodIndex}
						setSelectedMethodIndex={setSelectedMethodIndex}
						methodNames={methodNames}
						effectivePrerequisites={effectivePrerequisites}
						effectiveParameters={effectiveParameters}
						parameterValues={parameterValues}
						setParameterValues={setParameterValues}
						validationError={validationError}
						t={t}
					/>
				)}
				<DialogFooterContent
					installationComplete={installationComplete}
					isMcp={isMcp}
					onClose={onClose}
					handleInstall={handleInstall}
					handlePostInstallAction={handlePostInstallAction}
					t={t}
				/>
			</DialogContent>
		</Dialog>
	)
}
