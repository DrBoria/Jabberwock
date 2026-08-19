export { getShell } from "./config"
export { isShellAllowed, getSafeFallbackShell, SHELL_ALLOWLIST, SHELL_PATHS, normalizeShellPath } from "./paths"
export type {
	MacTerminalProfile,
	MacTerminalProfiles,
	WindowsTerminalProfile,
	WindowsTerminalProfiles,
	LinuxTerminalProfile,
	LinuxTerminalProfiles,
} from "./paths"
