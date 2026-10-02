import say from "say"

interface Say {
	speak: (text: string, voice?: string, speed?: number, callback?: (err?: string) => void) => void
	stop: () => void
}

type PlayTtsOptions = {
	onStart?: () => void
	onStop?: () => void
}

type QueueItem = {
	message: string
	options: PlayTtsOptions
}

const __moduleState = {
	isTtsEnabled: false,
	speed: 1.0,
	sayInstance: undefined as Say | undefined,
	queue: [] as QueueItem[],
}
export const setTtsEnabled = (enabled: boolean) => (__moduleState.isTtsEnabled = enabled)

export const setTtsSpeed = (newSpeed: number) => (__moduleState.speed = newSpeed)

export const playTts = async (message: string, options: PlayTtsOptions = {}) => {
	if (!__moduleState.isTtsEnabled) {
		return
	}

	try {
		__moduleState.queue.push({ message, options })
		await processQueue()
	} catch (_error) {}
}

export const stopTts = () => {
	__moduleState.sayInstance?.stop()
	__moduleState.sayInstance = undefined
	__moduleState.queue = []
}

const processQueue = async (): Promise<void> => {
	if (!__moduleState.isTtsEnabled || __moduleState.sayInstance) {
		return
	}

	const item = __moduleState.queue.shift()

	if (!item) {
		return
	}

	try {
		const { message: nextUtterance, options } = item

		await new Promise<void>((resolve, reject) => {
			__moduleState.sayInstance = say
			options.onStart?.()

			say.speak(nextUtterance, undefined, __moduleState.speed, (err) => {
				options.onStop?.()

				if (err) {
					reject(new Error(err))
				} else {
					resolve()
				}

				__moduleState.sayInstance = undefined
			})
		})

		await processQueue()
	} catch (_error) {
		__moduleState.sayInstance = undefined
		await processQueue()
	}
}
