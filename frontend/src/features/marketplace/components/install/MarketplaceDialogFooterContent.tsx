import React from "react"
import { DialogFooter } from "@src/shared/ui/overlays/dialog"
import { Button } from "@src/shared/ui/buttons/button"

interface DialogFooterContentProps {
	installationComplete: boolean
	isMcp: boolean
	onClose: () => void
	handleInstall: () => void
	handlePostInstallAction: (tab: "mcp" | "modes") => void
	t: (key: string, options?: Record<string, unknown>) => string
}

export const DialogFooterContent: React.FC<DialogFooterContentProps> = ({
	installationComplete,
	isMcp,
	onClose,
	handleInstall,
	handlePostInstallAction,
	t,
}) => (
	<DialogFooter>
		{installationComplete ? (
			<>
				<Button variant="outline" onClick={onClose}>
					{t("marketplace:install.done")}
				</Button>
				<Button onClick={() => handlePostInstallAction(isMcp ? "mcp" : "modes")}>
					{isMcp ? t("marketplace:install.goToMcp") : t("marketplace:install.goToModes")}
				</Button>
			</>
		) : (
			<>
				<Button variant="outline" onClick={onClose}>
					{t("common:answers.cancel")}
				</Button>
				<Button onClick={handleInstall}>{t("marketplace:install.button")}</Button>
			</>
		)}
	</DialogFooter>
)
