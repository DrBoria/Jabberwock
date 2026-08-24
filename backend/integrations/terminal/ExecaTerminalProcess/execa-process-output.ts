export function hasUnretrievedOutput(lastRetrievedIndex: number, fullOutputLength: number): boolean {
	return lastRetrievedIndex < fullOutputLength
}

export function getUnretrievedOutput(
	fullOutput: string,
	lastRetrievedIndex: number,
): { output: string; newIndex: number } {
	let output = fullOutput.slice(lastRetrievedIndex)
	const index = output.lastIndexOf("\n")

	if (index === -1) {
		return { output: "", newIndex: lastRetrievedIndex }
	}

	const newIndex = index + 1

	return { output: output.slice(0, newIndex), newIndex: lastRetrievedIndex + newIndex }
}

export function emitRemainingBufferIfListening(
	emit: (event: string, data: string) => void,
	isListening: boolean,
	fullOutput: string,
	lastRetrievedIndex: number,
): number {
	if (!isListening) {
		return lastRetrievedIndex
	}

	const { output, newIndex } = getUnretrievedOutput(fullOutput, lastRetrievedIndex)

	if (output !== "") {
		emit("line", output)
	}

	return newIndex
}
