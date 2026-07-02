// Type for Mistral tool definition - matches Mistral SDK Tool type
export type MistralTool = {
	type: "function"
	function: {
		name: string
		description?: string
		parameters: Record<string, unknown>
	}
}
