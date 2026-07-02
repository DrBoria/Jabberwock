export interface DisplayedMessage {
	ts: number
	text: string
	partial: boolean
}

export interface StreamState {
	ts: number
	text: string
	headerShown: boolean
}

export interface OutputManagerOptions {
	disabled?: boolean
	stdout?: NodeJS.WriteStream
	stderr?: NodeJS.WriteStream
}
