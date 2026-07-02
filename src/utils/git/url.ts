/**
 * Converts a git URL to HTTPS format
 * @param url The git URL to convert
 * @returns The URL in HTTPS format, or the original URL if conversion is not possible
 */
export function convertGitUrlToHttps(url: string): string {
	try {
		// Already HTTPS, just return it
		if (url.startsWith("https://")) {
			return url
		}

		// Handle SSH format: git@github.com:user/repo.git -> https://github.com/user/repo.git
		if (url.startsWith("git@")) {
			const match = url.match(/git@([^:]+):(.+)/)
			if (match && match.length === 3) {
				const [, host, path] = match
				return `https://${host}/${path}`
			}
		}

		// Handle SSH with protocol: ssh://git@github.com/user/repo.git -> https://github.com/user/repo.git
		if (url.startsWith("ssh://")) {
			const match = url.match(/ssh:\/\/(?:git@)?([^\/]+)\/(.+)/)
			if (match && match.length === 3) {
				const [, host, path] = match
				return `https://${host}/${path}`
			}
		}

		// Return original URL if we can't convert it
		return url
	} catch {
		// If parsing fails, return original
		return url
	}
}

/**
 * Sanitizes a git URL to remove sensitive information like tokens
 * @param url The original git URL
 * @returns Sanitized URL
 */
export function sanitizeGitUrl(url: string): string {
	try {
		// Remove credentials from HTTPS URLs
		if (url.startsWith("https://")) {
			const urlObj = new URL(url)
			// Remove username and password
			urlObj.username = ""
			urlObj.password = ""
			return urlObj.toString()
		}

		// For SSH URLs, return as-is (they don't contain sensitive tokens)
		if (url.startsWith("git@") || url.startsWith("ssh://")) {
			return url
		}

		// For other formats, return as-is but remove any potential tokens
		return url.replace(/:[a-f0-9]{40,}@/gi, "@")
	} catch {
		// If URL parsing fails, return original (might be SSH format)
		return url
	}
}

/**
 * Extracts repository name from a git URL
 * @param url The git URL
 * @returns Repository name or undefined
 */
export function extractRepositoryName(url: string): string {
	try {
		// Handle different URL formats
		const patterns = [
			// HTTPS: https://github.com/user/repo.git -> user/repo
			/https:\/\/[^\/]+\/([^\/]+\/[^\/]+?)(?:\.git)?$/,
			// SSH: git@github.com:user/repo.git -> user/repo
			/git@[^:]+:([^\/]+\/[^\/]+?)(?:\.git)?$/,
			// SSH with user: ssh://git@github.com/user/repo.git -> user/repo
			/ssh:\/\/[^\/]+\/([^\/]+\/[^\/]+?)(?:\.git)?$/,
		]

		for (const pattern of patterns) {
			const match = url.match(pattern)
			if (match && match[1]) {
				return match[1].replace(/\.git$/, "")
			}
		}

		return ""
	} catch {
		return ""
	}
}
