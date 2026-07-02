/**
 * Utilities for handling path-related operations in mentions
 */

/**
 * Escapes spaces in a path with backslashes
 *
 * @param path The path to escape
 * @returns A path with spaces escaped
 */
export function escapeSpaces(path: string): string {
	const escaped = path.replace(/ /g, "\\ ")
	return escaped
}

/**
 * Converts an absolute path to a mention-friendly path
 * If the provided path starts with the current working directory,
 * it's converted to a relative path prefixed with @
 * Spaces in the path are escaped with backslashes
 *
 * @param path The path to convert
 * @param cwd The current working directory
 * @returns A mention-friendly path
 */
function stripProtocol(path: string): string {
	if (path.startsWith("file://")) {
		return path.substring(7)
	}
	if (path.startsWith("vscode-remote://")) {
		const protocolStripped = path.substring("vscode-remote://".length)
		const firstSlashIndex = protocolStripped.indexOf("/")
		return firstSlashIndex !== -1 ? protocolStripped.substring(firstSlashIndex + 1) : ""
	}
	return path
}

function decodePath(path: string): string {
	try {
		const decoded = decodeURIComponent(path)
		if (decoded.startsWith("/") && decoded[2] === ":") {
			return decoded.substring(1)
		}
		return decoded
	} catch (e) {
		console.error("[jabberwock] Error decoding URI component in convertToMentionPath:", e, path)
		return path
	}
}

export function convertToMentionPath(path: string, cwd?: string): string {
	const pathWithoutProtocol = stripProtocol(path)
	const cleanedPath = decodePath(pathWithoutProtocol)

	const normalizedPath = cleanedPath.replace(/\\/g, "/")
	const normalizedCwd = cwd ? cwd.replace(/\\/g, "/") : ""

	if (!normalizedCwd) {
		return cleanedPath
	}

	const trimmedCwd = normalizedCwd.endsWith("/") ? normalizedCwd.slice(0, -1) : normalizedCwd

	const lowerPath = normalizedPath.toLowerCase()
	const lowerCwd = trimmedCwd.toLowerCase()

	if (lowerPath.startsWith(lowerCwd)) {
		let relativePath = normalizedPath.substring(trimmedCwd.length)
		relativePath = relativePath.startsWith("/") ? relativePath : "/" + relativePath
		return "@" + escapeSpaces(relativePath)
	}

	return cleanedPath
}
