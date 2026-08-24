export interface ProxyConfig {
	/** Whether the debug proxy is enabled */
	enabled: boolean
	/** The proxy server URL (e.g., http://127.0.0.1:8888) */
	serverUrl: string
	/** Accept self-signed/insecure TLS certificates from the proxy (required for MITM) */
	tlsInsecure: boolean
	/** Whether running in debug/development mode */
	isDebugMode: boolean
}
