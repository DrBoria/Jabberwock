// Thinking content block (content_block_start with type "thinking")
export interface ThinkingContentBlock {
	type: "thinking"
	thinking: string
	signature?: string
}

// Thinking delta event (content_block_delta with type "thinking_delta")
export interface ThinkingDelta {
	type: "thinking_delta"
	thinking: string
}

// Input JSON delta (content_block_delta with type "input_json_delta")
export interface InputJsonDelta {
	type: "input_json_delta"
	partial_json: string
}
