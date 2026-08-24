import * as vscode from "vscode"
import { userInfo } from "os"
import {
	SHELL_PATHS,
	normalizeShellPath,
	isShellAllowed,
	getSafeFallbackShell,
	type WindowsTerminalProfile,
	type WindowsTerminalProfiles,
	type MacTerminalProfiles,
	type LinuxTerminalProfiles,
} from "./paths"

function getWindowsTerminalConfig() {
	try {
		const config = vscode.workspace.getConfiguration("terminal.integrated")
		const defaultProfileName = config.get<string>("defaultProfile.windows")
		const profiles = config.get<WindowsTerminalProfiles>("profiles.windows") || {}
		return { defaultProfileName, profiles }
	} catch {
		return { defaultProfileName: null, profiles: {} as WindowsTerminalProfiles }
	}
}

function getMacTerminalConfig() {
	try {
		const config = vscode.workspace.getConfiguration("terminal.integrated")
		const defaultProfileName = config.get<string>("defaultProfile.osx")
		const profiles = config.get<MacTerminalProfiles>("profiles.osx") || {}
		return { defaultProfileName, profiles }
	} catch {
		return { defaultProfileName: null, profiles: {} as MacTerminalProfiles }
	}
}

function getLinuxTerminalConfig() {
	try {
		const config = vscode.workspace.getConfiguration("terminal.integrated")
		const defaultProfileName = config.get<string>("defaultProfile.linux")
		const profiles = config.get<LinuxTerminalProfiles>("profiles.linux") || {}
		return { defaultProfileName, profiles }
	} catch {
		return { defaultProfileName: null, profiles: {} as LinuxTerminalProfiles }
	}
}

function resolvePowerShellPath(profile: WindowsTerminalProfile | undefined): string {
	const normalizedPath = normalizeShellPath(profile?.path)
	if (normalizedPath) {
		return normalizedPath
	}
	if (profile?.source === "PowerShell") {
		return SHELL_PATHS.POWERSHELL_7
	}
	return SHELL_PATHS.POWERSHELL_LEGACY
}

/** Attempts to retrieve a shell path from VS Code config on Windows. */
function getWindowsShellFromVSCode(): string | null {
	const { defaultProfileName, profiles } = getWindowsTerminalConfig()
	if (!defaultProfileName) {
		return null
	}

	const profile = profiles[defaultProfileName]

	if (defaultProfileName.toLowerCase().includes("powershell")) {
		return resolvePowerShellPath(profile)
	}

	const normalizedPath = normalizeShellPath(profile?.path)
	if (normalizedPath) {
		return normalizedPath
	}

	if (profile?.source === "WSL" || defaultProfileName.toLowerCase().includes("wsl")) {
		return SHELL_PATHS.WSL_BASH
	}

	return SHELL_PATHS.CMD
}

/** Attempts to retrieve a shell path from VS Code config on macOS. */
function getMacShellFromVSCode(): string | null {
	const { defaultProfileName, profiles } = getMacTerminalConfig()
	if (!defaultProfileName) {
		return null
	}

	const profile = profiles[defaultProfileName]
	return normalizeShellPath(profile?.path)
}

/** Attempts to retrieve a shell path from VS Code config on Linux. */
function getLinuxShellFromVSCode(): string | null {
	const { defaultProfileName, profiles } = getLinuxTerminalConfig()
	if (!defaultProfileName) {
		return null
	}

	const profile = profiles[defaultProfileName]
	return normalizeShellPath(profile?.path)
}

/**
 * Tries to get a user's shell from os.userInfo() (works on Unix if the
 * underlying system call is supported). Returns null on error or if not found.
 */
function getShellFromUserInfo(): string | null {
	try {
		const { shell } = userInfo()
		return shell || null
	} catch {
		return null
	}
}

/** Returns the environment-based shell variable, or null if not set. */
function getShellFromEnv(): string | null {
	const { env } = process

	if (process.platform === "win32") {
		return env.COMSPEC || "C:\\Windows\\System32\\cmd.exe"
	}

	if (process.platform === "darwin") {
		return env.SHELL || "/bin/zsh"
	}

	if (process.platform === "linux") {
		return env.SHELL || "/bin/bash"
	}
	return null
}

export function getShell(): string {
	let shell: string | null = null

	// 1. Check VS Code config first.
	if (process.platform === "win32") {
		shell = getWindowsShellFromVSCode()
	} else if (process.platform === "darwin") {
		shell = getMacShellFromVSCode()
	} else if (process.platform === "linux") {
		shell = getLinuxShellFromVSCode()
	}

	// 2. If no shell from VS Code, try userInfo()
	if (!shell) {
		shell = getShellFromUserInfo()
	}

	// 3. If still nothing, try environment variable
	if (!shell) {
		shell = getShellFromEnv()
	}

	// 4. Finally, fall back to a default
	if (!shell) {
		shell = getSafeFallbackShell()
	}

	// 5. Validate the shell against allowlist
	if (!isShellAllowed(shell)) {
		shell = getSafeFallbackShell()
	}

	return shell
}
