function hasPartialMultibyteChar(segment: string, curLine: string): boolean {
	const segmentLastCharCode = segment.length > 0 ? segment.charCodeAt(segment.length - 1) : 0
	const partialCharCode = curLine.length > segment.length ? curLine.charCodeAt(segment.length) : 0
	return (
		(segmentLastCharCode >= 0xd800 && segmentLastCharCode <= 0xdbff) ||
		(partialCharCode >= 0xdc00 && partialCharCode <= 0xdfff) ||
		(curLine.length > segment.length + 1 && partialCharCode >= 0xd800 && partialCharCode <= 0xdbff)
	)
}

function applyOverwriteSegment(curLine: string, segment: string): string {
	if (segment.length >= curLine.length) {
		return segment
	}
	if (hasPartialMultibyteChar(segment, curLine)) {
		return segment + " " + curLine.substring(segment.length + 1)
	}
	return segment + curLine.substring(segment.length)
}

function processLineWithCarriageReturns(
	input: string,
	initialLine: string,
	initialCrPos: number,
	lineEnd: number,
): string {
	let curLine = initialLine
	let crPos = initialCrPos
	while (crPos < lineEnd) {
		let nextCrPos = input.indexOf("\r", crPos + 1)
		if (nextCrPos === -1 || nextCrPos >= lineEnd) nextCrPos = lineEnd
		const segment = input.substring(crPos + 1, nextCrPos)
		if (segment !== "") {
			curLine = applyOverwriteSegment(curLine, segment)
		}
		crPos = nextCrPos
	}
	return curLine
}

export function processCarriageReturns(input: string): string {
	if (input.indexOf("\r") === -1) return input
	let output = ""
	let i = 0
	const len = input.length
	while (i < len) {
		let lineEnd = input.indexOf("\n", i)
		if (lineEnd === -1) lineEnd = len
		let crPos = input.indexOf("\r", i)
		if (crPos === -1 || crPos >= lineEnd) {
			output += input.substring(i, lineEnd)
		} else {
			let curLine = input.substring(i, crPos)
			curLine = processLineWithCarriageReturns(input, curLine, crPos, lineEnd)
			output += curLine
		}
		if (lineEnd < len) output += "\n"
		i = lineEnd + 1
	}
	return output
}

export function processBackspaces(input: string): string {
	let output = ""
	let pos = 0
	let bsPos = input.indexOf("\b")
	while (bsPos !== -1) {
		output += input.substring(pos, bsPos - 1)
		pos = bsPos + 1
		let count = 0
		while (input[pos] === "\b") {
			count++
			pos++
		}
		if (count > 0 && output.length > 0) {
			output = output.substring(0, Math.max(0, output.length - count))
		}
		bsPos = input.indexOf("\b", pos)
	}
	if (pos < input.length) {
		output += input.substring(pos)
	}
	return output
}
