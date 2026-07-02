/**
 * Sanitizes error messages by removing sensitive information like file paths and URLs
 * @param errorMessage The error message to sanitize
 * @returns The sanitized error message
 */
export function sanitizeErrorMessage(errorMessage: string): string {
	if (!errorMessage || typeof errorMessage !== "string") {
		return String(errorMessage)
	}

	let sanitized = errorMessage

	// Replace URLs first (http, https, ftp, file protocols)
	// This needs to be done before file paths to avoid partial replacements
	sanitized = sanitized.replace(
		/(?:https?|ftp|file):\/\/(?:localhost|[\w\-\.]+)(?::\d+)?(?:\/[\w\-\.\/\?\&\=\#]*)?/gi,
		"[REDACTED_URL]",
	)

	// Replace email addresses
	sanitized = sanitized.replace(/[\w\-\.]+@[\w\-\.]+\.\w+/g, "[REDACTED_EMAIL]")

	// Replace IP addresses (IPv4)
	sanitized = sanitized.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[REDACTED_IP]")

	// Replace file paths in quotes (handles paths with spaces)
	sanitized = sanitized.replace(/"[^"]*(?:\/|\\)[^"]*"/g, '"[REDACTED_PATH]"')

	// Replace file paths (Unix and Windows style)
	// Matches paths like /Users/username/path, C:\Users\path, ./relative/path, ../relative/path
	sanitized = sanitized.replace(
		/(?:\/[\w\-\.]+)+(?:\/[\w\-\.\s]*)*|(?:[A-Za-z]:\\[\w\-\.\\]+)|(?:\.{1,2}\/[\w\-\.\/]+)/g,
		"[REDACTED_PATH]",
	)

	// Replace port numbers that appear after colons (e.g., :11434, :8080)
	// Do this after URLs to avoid double replacement
	sanitized = sanitized.replace(/(?<!REDACTED_URL\]):(\d{2,5})\b/g, ":[REDACTED_PORT]")

	return sanitized
}
