import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { Trans } from "react-i18next"
import { buildDocLink } from "@/utils/misc/docLinks"
import type { ExtensionMessage } from "@jabberwock/types"

export const defaultTimeout = (value: number | undefined): number => value ?? 5000
export const defaultDelay = (value: number | undefined): number => value ?? 50
export const defaultFalse = (value: boolean | undefined): boolean => value ?? false
export const defaultTrue = (value: boolean | undefined): boolean => value ?? true

export const handleVscodeSettingMessage = (event: MessageEvent, setInheritEnv: (v: boolean) => void) => {
	const message: ExtensionMessage = event.data
	if (message.type === "vsCodeSetting" && message.setting === "terminal.integrated.inheritEnv")
		setInheritEnv((message.value as boolean) ?? true)
}

export const docLink = (path: string, id: string) => (
	<VSCodeLink href={buildDocLink(path, id)} style={{ display: "inline" }}>
		{" "}
	</VSCodeLink>
)

export const SettingDescription = ({ i18nKey, href, linkId }: { i18nKey: string; href: string; linkId: string }) => (
	<div className="text-vscode-descriptionForeground text-sm mt-1">
		<Trans i18nKey={i18nKey}>{docLink(href, linkId)}</Trans>
	</div>
)
