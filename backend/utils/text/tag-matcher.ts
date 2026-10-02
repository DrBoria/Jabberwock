export interface TagMatcherResult {
	matched: boolean
	data: string
}

/**
 * Structural shape of a tag matcher instance.
 */
export interface TagMatcherShape<Result> {
	tagName: string
	transform?: (chunks: TagMatcherResult) => Result
	position: number
	final(chunk?: string): Result[]
	update(chunk: string): Result[]
}

/**
 * Streaming matcher for lightweight tag-delimited regions.
 *
 * Used to separate content inside `<tag>...</tag>` from "surrounding" text.
 * This is used for reasoning tags like `think.../think` in provider streams.
 */
export function TagMatcher<Result = TagMatcherResult>(
	tagName: string,
	transform?: (chunks: TagMatcherResult) => Result,
	position = 0,
): TagMatcherShape<Result> {
	let index = 0
	let chunks: TagMatcherResult[] = []
	let cached: string[] = []
	let matched: boolean = false
	let state: "TEXT" | "TAG_OPEN" | "TAG_CLOSE" = "TEXT"
	let depth = 0
	let pointer = 0

	function collect() {
		if (!cached.length) {
			return
		}
		const last = chunks.at(-1)
		const data = cached.join("")
		const isMatched = matched
		if (last?.matched === isMatched) {
			last.data += data
		} else {
			chunks.push({
				data,
				matched: isMatched,
			})
		}
		cached = []
	}

	function pop(): Result[] {
		const currentChunks = chunks
		chunks = []
		if (!transform) {
			return currentChunks as Result[]
		}
		return currentChunks.map(transform)
	}

	function handleTextState(char: string): void {
		if (char === "<" && (pointer <= position + 1 || matched)) {
			state = "TAG_OPEN"
			index = 0
		} else {
			collect()
		}
	}

	function handleTagOpenState(char: string): void {
		if (char === ">" && index === tagName.length) {
			state = "TEXT"
			if (!matched) {
				cached = []
			}
			depth++
			matched = true
		} else if (index === 0 && char === "/") {
			state = "TAG_CLOSE"
		} else if (char === " " && (index === 0 || index === tagName.length)) {
			return
		} else if (tagName[index] === char) {
			index++
		} else {
			state = "TEXT"
			collect()
		}
	}

	function handleTagCloseState(char: string): void {
		if (char === ">" && index === tagName.length) {
			state = "TEXT"
			depth--
			matched = depth > 0
			if (!matched) {
				cached = []
			}
		} else if (char === " " && (index === 0 || index === tagName.length)) {
			return
		} else if (tagName[index] === char) {
			index++
		} else {
			state = "TEXT"
			collect()
		}
	}

	function _update(chunk: string) {
		for (const char of chunk) {
			cached.push(char)
			pointer++

			if (state === "TEXT") {
				handleTextState(char)
			} else if (state === "TAG_OPEN") {
				handleTagOpenState(char)
			} else if (state === "TAG_CLOSE") {
				handleTagCloseState(char)
			}
		}
	}

	return {
		tagName,
		transform,
		position,
		final(chunk?: string): Result[] {
			if (chunk) {
				_update(chunk)
			}
			collect()
			return pop()
		},
		update(chunk: string): Result[] {
			_update(chunk)
			return pop()
		},
	}
}

export type TagMatcher<Result = TagMatcherResult> = TagMatcherShape<Result>
