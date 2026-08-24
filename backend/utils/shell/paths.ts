import * as path from "path"

// Security: Allowlist of approved shell executables to prevent arbitrary command execution
export const SHELL_ALLOWLIST = new Set<string>([
	// Windows PowerShell variants
	"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
	"C:\\Program Files\\PowerShell\\7\\pwsh.exe",
	"C:\\Program Files\\PowerShell\\6\\pwsh.exe",
	"C:\\Program Files\\PowerShell\\5\\pwsh.exe",

	// Windows Command Prompt
	"C:\\Windows\\System32\\cmd.exe",

	// Windows WSL
	"C:\\Windows\\System32\\wsl.exe",

	// Git Bash on Windows
	"C:\\Program Files\\Git\\bin\\bash.exe",
	"C:\\Program Files\\Git\\usr\\bin\\bash.exe",
	"C:\\Program Files (x86)\\Git\\bin\\bash.exe",
	"C:\\Program Files (x86)\\Git\\usr\\bin\\bash.exe",

	// MSYS2/MinGW/Cygwin on Windows
	"C:\\msys64\\usr\\bin\\bash.exe",
	"C:\\msys32\\usr\\bin\\bash.exe",
	"C:\\MinGW\\msys\\1.0\\bin\\bash.exe",
	"C:\\cygwin64\\bin\\bash.exe",
	"C:\\cygwin\\bin\\bash.exe",

	// Unix/Linux/macOS - Bourne-compatible shells
	"/bin/sh",
	"/usr/bin/sh",
	"/bin/bash",
	"/usr/bin/bash",
	"/usr/local/bin/bash",
	"/opt/homebrew/bin/bash",
	"/opt/local/bin/bash",

	// Z Shell
	"/bin/zsh",
	"/usr/bin/zsh",
	"/usr/local/bin/zsh",
	"/opt/homebrew/bin/zsh",
	"/opt/local/bin/zsh",

	// Dash
	"/bin/dash",
	"/usr/bin/dash",

	// Ash
	"/bin/ash",
	"/usr/bin/ash",

	// C Shells
	"/bin/csh",
	"/usr/bin/csh",
	"/bin/tcsh",
	"/usr/bin/tcsh",
	"/usr/local/bin/tcsh",

	// Korn Shells
	"/bin/ksh",
	"/usr/bin/ksh",
	"/bin/ksh93",
	"/usr/bin/ksh93",
	"/bin/mksh",
	"/usr/bin/mksh",
	"/bin/pdksh",
	"/usr/bin/pdksh",

	// Fish Shell
	"/usr/bin/fish",
	"/usr/local/bin/fish",
	"/opt/homebrew/bin/fish",
	"/opt/local/bin/fish",

	// Modern shells
	"/usr/bin/elvish",
	"/usr/local/bin/elvish",
	"/usr/bin/xonsh",
	"/usr/local/bin/xonsh",
	"/usr/bin/nu",
	"/usr/local/bin/nu",
	"/usr/bin/nushell",
	"/usr/local/bin/nushell",
	"/usr/bin/ion",
	"/usr/local/bin/ion",

	// BusyBox
	"/bin/busybox",
	"/usr/bin/busybox",
])

export const SHELL_PATHS = {
	// Windows paths
	POWERSHELL_7: "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
	POWERSHELL_LEGACY: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
	CMD: "C:\\Windows\\System32\\cmd.exe",
	WSL_BASH: "/bin/bash",
	// Unix paths
	MAC_DEFAULT: "/bin/zsh",
	LINUX_DEFAULT: "/bin/bash",
	CSH: "/bin/csh",
	BASH: "/bin/bash",
	KSH: "/bin/ksh",
	SH: "/bin/sh",
	ZSH: "/bin/zsh",
	DASH: "/bin/dash",
	TCSH: "/bin/tcsh",
	FALLBACK: "/bin/sh",
} as const

export interface MacTerminalProfile {
	path?: string | string[]
}

export type MacTerminalProfiles = Record<string, MacTerminalProfile>

export interface WindowsTerminalProfile {
	path?: string | string[]
	source?: "PowerShell" | "WSL"
}

export type WindowsTerminalProfiles = Record<string, WindowsTerminalProfile>

export interface LinuxTerminalProfile {
	path?: string | string[]
}

export type LinuxTerminalProfiles = Record<string, LinuxTerminalProfile>

/**
 * Normalizes a path that can be either a string or an array of strings.
 * If it's an array, returns the first element. Otherwise returns the string.
 */
export function normalizeShellPath(shellPath: string | string[] | undefined): string | null {
	if (!shellPath) return null
	if (Array.isArray(shellPath)) {
		return shellPath.length > 0 ? shellPath[0] : null
	}
	return shellPath
}

/**
 * Validates if a shell path is in the allowlist to prevent arbitrary command execution
 */
export function isShellAllowed(shellPath: string): boolean {
	if (!shellPath) return false

	const normalizedPath = path.normalize(shellPath)

	// Direct lookup first
	if (SHELL_ALLOWLIST.has(normalizedPath)) {
		return true
	}

	// On Windows, try case-insensitive comparison
	if (process.platform === "win32") {
		const lowerPath = normalizedPath.toLowerCase()
		for (const allowedPath of SHELL_ALLOWLIST) {
			if (allowedPath.toLowerCase() === lowerPath) {
				return true
			}
		}
	}

	return false
}

/**
 * Returns a safe fallback shell based on the platform
 */
export function getSafeFallbackShell(): string {
	if (process.platform === "win32") {
		return SHELL_PATHS.CMD
	} else if (process.platform === "darwin") {
		return SHELL_PATHS.MAC_DEFAULT
	} else {
		return SHELL_PATHS.LINUX_DEFAULT
	}
}
