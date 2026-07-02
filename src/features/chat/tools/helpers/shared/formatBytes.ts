/**
 * Formats a byte count into a human-readable string.
 * @param bytes - The number of bytes.
 * @param suffix - The suffix to use (default: "B", e.g., "1023B", "1.0KB").
 */
export function formatBytes(bytes: number, suffix: string = "B"): string {
	if (bytes < 1024) {
		return `${bytes}${suffix}`
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)}KB`
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}
