export interface McpServerRequestData {
	serverName: string
	type: "use_mcp_tool" | "access_mcp_resource"
	toolName?: string
	arguments?: string
	uri?: string
	response?: string
}

export interface ApiReqData {
	request?: string
	tokensIn?: number
	tokensOut?: number
	cacheWrites?: number
	cacheReads?: number
	cost?: number
	cancelReason?: CancelReason
	streamingFailedMessage?: string
	apiProtocol?: "anthropic" | "openai"
}

export type CancelReason = "streaming_failed" | "user_cancelled"
