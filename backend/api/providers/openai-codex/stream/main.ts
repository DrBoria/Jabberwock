import type { ApiStream } from "@api/transform/stream"
import type { OpenAiCodexModel, StreamState, StreamDeps } from "@api/providers/openai-codex/types"
import { handleParsedStreamEvent } from "./process"

export async function* handleStreamResponse(
	body: ReadableStream<Uint8Array>,
	model: OpenAiCodexModel,
	state: StreamState,
	deps: StreamDeps,
	abortController?: AbortController,
): ApiStream {
	const reader = body.getReader()
	const decoder = new TextDecoder()
	let buffer = ""

	try {
		while (true) {
			if (abortController?.signal.aborted) {
				break
			}

			const readResult = await reader.read()
			if (readResult.done) break

			buffer += decoder.decode(readResult.value, { stream: true })
			const lines = buffer.split("\n")
			buffer = lines.pop() || ""

			yield* processStreamLines(lines, model, state, deps)
		}
	} finally {
		reader.releaseLock()
	}
}

async function* processStreamLines(
	lines: string[],
	model: OpenAiCodexModel,
	state: StreamState,
	deps: StreamDeps,
): ApiStream {
	for (const line of lines) {
		if (line.startsWith("data: ")) {
			const data = line.slice(6).trim()
			if (data === "[DONE]") {
				continue
			}
			yield* processParsedDataLine(data, model, state, deps)
		} else if (line.trim() && !line.startsWith(":")) {
			yield* handleNonDataLine(line, state)
		}
	}
	return void 0
}

async function* processParsedDataLine(
	data: string,
	model: OpenAiCodexModel,
	state: StreamState,
	deps: StreamDeps,
): ApiStream {
	try {
		const parsed = JSON.parse(data) as Record<string, unknown>
		return yield* handleParsedStreamEvent(parsed, model, state, deps)
	} catch (e) {
		if (!(e instanceof SyntaxError)) {
			throw e
		}
	}
	return void 0
}

async function* handleNonDataLine(line: string, state: StreamState): ApiStream {
	try {
		const parsed = JSON.parse(line) as Record<string, unknown>
		const text = (parsed.content || parsed.text || parsed.message) as string | undefined
		if (text) {
			state.sawTextOutputInCurrentResponse = true
			yield { type: "text", text }
		}
	} catch {
		// Not JSON, ignore
	}
	return void 0
}
