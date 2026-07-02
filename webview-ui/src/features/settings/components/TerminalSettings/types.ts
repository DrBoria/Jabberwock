import type { HTMLAttributes } from "react"
import type { TerminalOutputPreviewSize } from "@jabberwock/types"
import type { SetCachedStateField } from "../shared/types"

export type TerminalSettingsProps = HTMLAttributes<HTMLDivElement> & {
	terminalOutputPreviewSize?: TerminalOutputPreviewSize
	terminalShellIntegrationTimeout?: number
	terminalShellIntegrationDisabled?: boolean
	terminalCommandDelay?: number
	terminalPowershellCounter?: boolean
	terminalZshClearEolMark?: boolean
	terminalZshOhMy?: boolean
	terminalZshP10k?: boolean
	terminalZdotdir?: boolean
	setCachedStateField: SetCachedStateField<
		| "terminalOutputPreviewSize"
		| "terminalShellIntegrationTimeout"
		| "terminalShellIntegrationDisabled"
		| "terminalCommandDelay"
		| "terminalPowershellCounter"
		| "terminalZshClearEolMark"
		| "terminalZshOhMy"
		| "terminalZshP10k"
		| "terminalZdotdir"
	>
}

export type AdvancedProps = {
	terminalShellIntegrationDisabled?: boolean
	terminalShellIntegrationTimeout?: number
	terminalCommandDelay?: number
	terminalPowershellCounter?: boolean
	terminalZshClearEolMark?: boolean
	terminalZshOhMy?: boolean
	terminalZshP10k?: boolean
	terminalZdotdir?: boolean
	inheritEnv: boolean
	setCachedStateField: TerminalSettingsProps["setCachedStateField"]
	setInheritEnv: (v: boolean) => void
	t: (key: string) => string
}
