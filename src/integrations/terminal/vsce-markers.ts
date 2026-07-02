/**
 * Pure utility functions for VSCode shell integration marker processing.
 *
 * VSCode shell integration uses OSC 633 and OSC 133 sequences to mark
 * prompt boundaries, command starts/ends, etc. These functions handle
 * matching, extracting, and cleaning these markers from terminal output.
 */

const ESC = String.fromCharCode(0x1b)
const BEL = String.fromCharCode(0x07)

/**
 * Match content between optional prefix and suffix in a string.
 * Supports bell-terminated sequences for OSC markers.
 *
 * Using string indexOf matching is ~500x faster than regular expressions.
 */
export function stringIndexMatch(
	data: string,
	prefix?: string,
	suffix?: string,
	bell: string = "\x07",
): string | undefined {
	let startIndex: number
	let endIndex: number
	let prefixLength: number

	if (prefix === undefined) {
		startIndex = 0
		prefixLength = 0
	} else {
		startIndex = data.indexOf(prefix)

		if (startIndex === -1) {
			return undefined
		}

		if (bell.length > 0) {
			const bellIndex = data.indexOf(bell, startIndex + prefix.length)

			if (bellIndex === -1) {
				return undefined
			}

			const distanceToBell = bellIndex - startIndex
			prefixLength = distanceToBell + bell.length
		} else {
			prefixLength = prefix.length
		}
	}

	const contentStart = startIndex + prefixLength

	if (suffix === undefined) {
		endIndex = data.length
	} else {
		endIndex = data.indexOf(suffix, contentStart)

		if (endIndex === -1) {
			return undefined
		}
	}

	return data.slice(contentStart, endIndex)
}

/**
 * Remove only VSCode shell integration sequences (OSC 633/133) while
 * preserving standard ANSI SGR escape codes for color/formatting.
 *
 * Standard ANSI SGR sequences (e.g., \x1B[32m for green) are preserved
 * so the frontend can render them as styled HTML.
 */
export function removeVSCodeShellIntegration(text: string): string {
	const osc633Regex = new RegExp(ESC + "\\]633;[^" + BEL + ESC + "]*(?:" + BEL + "|" + ESC + "\\\\)", "g")
	const osc133Regex = new RegExp(ESC + "\\]133;[^" + BEL + ESC + "]*(?:" + BEL + "|" + ESC + "\\\\)", "g")
	const oscOtherRegex = new RegExp(ESC + "\\][0-9]+;[^" + BEL + ESC + "]*(?:" + BEL + "|" + ESC + "\\\\)", "g")

	return text.replace(osc633Regex, "").replace(osc133Regex, "").replace(oscOtherRegex, "")
}

/**
 * Strip cursor movement and erase sequences from terminal output.
 * Preserves color/style SGR codes.
 */
export function stripCursorSequences(text: string): string {
	const cursorMoveRegex = new RegExp(ESC + "\\[\\d*[ABCDEFGHJ]", "g")
	const cursorSaveRegex = new RegExp(ESC + "\\[su", "g")
	const eraseRegex = new RegExp(ESC + "\\[\\d*[KJ]", "g")
	const cursorHideRegex = new RegExp(ESC + "\\[\\?25[hl]", "g")
	const scrollRegex = new RegExp(ESC + "\\[\\d*;\\d*r", "g")

	return text
		.replace(cursorMoveRegex, "")
		.replace(cursorSaveRegex, "")
		.replace(eraseRegex, "")
		.replace(cursorHideRegex, "")
		.replace(scrollRegex, "")
}

/**
 * Handles VSCode shell integration markers for command output.
 *
 * For C (Command Start):
 * - Looks for content after ]633;C or ]133;C markers
 * - Checks 633 first since it's more commonly used
 *
 * For D (Command End):
 * - Looks for content before ]633;D or ]133;D markers
 * - Checks 633 first since it's more commonly used
 *
 * @param data The string to search for markers in
 * @param startMarkers Array of start markers (e.g. ["\x1b]633;C", "\x1b]133;C"]) to match content AFTER
 * @param endMarkers Array of end markers (e.g. ["\x1b]633;D", "\x1b]133;D"]) to match content BEFORE
 * @returns The content between/after markers, or undefined if no markers found
 */
export function matchVsceMarkers(data: string, startMarkers?: string[], endMarkers?: string[]): string | undefined {
	let result: string | undefined

	if (startMarkers && startMarkers.length > 0) {
		for (const marker of startMarkers) {
			const match = stringIndexMatch(data, marker, undefined)

			if (match !== undefined) {
				result = match
			}
		}

		return result
	}

	if (endMarkers && endMarkers.length > 0) {
		for (const marker of endMarkers) {
			const match = stringIndexMatch(data, undefined, marker)

			if (match === undefined) {
				return result
			}

			result = match
		}

		return result
	}

	return undefined
}
