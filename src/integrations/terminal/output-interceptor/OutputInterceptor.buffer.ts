export class PreviewBuffer {
	headBuffer: string = ""
	tailBuffer: string = ""
	headBytes: number = 0
	tailBytes: number = 0
	omittedBytes: number = 0

	private readonly headBudget: number
	private readonly tailBudget: number

	constructor(previewBytes: number) {
		this.headBudget = Math.floor(previewBytes / 2)
		this.tailBudget = previewBytes - this.headBudget
	}

	add(chunk: string): void {
		let remaining = chunk
		let remainingBytes = Buffer.byteLength(chunk, "utf8")

		if (this.headBytes < this.headBudget) {
			const headRoom = this.headBudget - this.headBytes
			if (remainingBytes <= headRoom) {
				this.headBuffer += remaining
				this.headBytes += remainingBytes
				return
			}
			const headPortion = this.sliceByBytes(remaining, headRoom)
			this.headBuffer += headPortion
			this.headBytes += headRoom
			remaining = remaining.slice(headPortion.length)
			remainingBytes = Buffer.byteLength(remaining, "utf8")
		}

		this.addToTail(remaining, remainingBytes)
	}

	private addToTail(chunk: string, chunkBytes: number): void {
		if (this.tailBudget === 0) {
			this.omittedBytes += chunkBytes
			return
		}

		if (chunkBytes >= this.tailBudget) {
			const dropped = this.tailBytes + (chunkBytes - this.tailBudget)
			this.omittedBytes += dropped
			this.tailBuffer = this.sliceByBytesFromEnd(chunk, this.tailBudget)
			this.tailBytes = this.tailBudget
			return
		}

		this.tailBuffer += chunk
		this.tailBytes += chunkBytes

		this.trimToFit()
	}

	private trimToFit(): void {
		while (this.tailBytes > this.tailBudget && this.tailBuffer.length > 0) {
			const excess = this.tailBytes - this.tailBudget
			let removed = 0
			let removeChars = 0
			while (removed < excess && removeChars < this.tailBuffer.length) {
				const charBytes = Buffer.byteLength(this.tailBuffer[removeChars], "utf8")
				removed += charBytes
				removeChars++
			}
			this.omittedBytes += removed
			this.tailBytes -= removed
			this.tailBuffer = this.tailBuffer.slice(removeChars)
		}
	}

	private sliceByBytes(str: string, maxBytes: number): string {
		let bytes = 0
		let i = 0
		while (i < str.length && bytes < maxBytes) {
			const charBytes = Buffer.byteLength(str[i], "utf8")
			if (bytes + charBytes > maxBytes) {
				break
			}
			bytes += charBytes
			i++
		}
		return str.slice(0, i)
	}

	private sliceByBytesFromEnd(str: string, maxBytes: number): string {
		let bytes = 0
		let i = str.length - 1
		while (i >= 0 && bytes < maxBytes) {
			const charBytes = Buffer.byteLength(str[i], "utf8")
			if (bytes + charBytes > maxBytes) {
				break
			}
			bytes += charBytes
			i--
		}
		return str.slice(i + 1)
	}

	getBuffer(): string {
		return this.headBuffer + this.tailBuffer
	}

	getPreview(): string {
		if (this.omittedBytes > 0) {
			const omissionIndicator = `\n[...${this.omittedBytes} bytes omitted...]\n`
			return this.headBuffer + omissionIndicator + this.tailBuffer
		}
		return this.headBuffer + this.tailBuffer
	}
}
