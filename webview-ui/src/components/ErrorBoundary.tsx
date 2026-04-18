import React, { Component } from "react"
import { telemetryClient } from "@src/utils/TelemetryClient"
import { enhanceErrorWithSourceMaps } from "@src/utils/sourceMapUtils"
import { vscode } from "@src/utils/vscode"

type ErrorProps = {
	children: React.ReactNode
	t?: (key: string) => string
}

type ErrorState = {
	error?: string
	componentStack?: string | null
	timestamp?: number
}

class ErrorBoundary extends Component<ErrorProps, ErrorState> {
	constructor(props: ErrorProps) {
		super(props)
		this.state = {}
	}

	static getDerivedStateFromError(error: unknown) {
		let errorMessage = ""

		if (error instanceof Error) {
			errorMessage = error.stack ?? error.message
		} else {
			errorMessage = `${error}`
		}

		return {
			error: errorMessage,
			timestamp: Date.now(),
		}
	}

	async componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		const componentStack = errorInfo.componentStack || ""
		const enhancedError = await enhanceErrorWithSourceMaps(error, componentStack)

		const errorMessage = enhancedError.message
		const stack = enhancedError.sourceMappedStack || enhancedError.stack
		const fullComponentStack = enhancedError.sourceMappedComponentStack || componentStack

		telemetryClient.capture("error_boundary_caught_error", {
			error: errorMessage,
			stack: stack,
			componentStack: fullComponentStack,
			timestamp: Date.now(),
			errorType: enhancedError.name,
		})

		// Report error to extension
		vscode.postMessage({
			type: "webviewError",
			text: `${errorMessage}\nStack: ${stack}\nComponent Stack: ${fullComponentStack}`,
		})

		this.setState({
			error: stack,
			componentStack: fullComponentStack,
		})
	}

	render() {
		const t =
			this.props.t ||
			((key: string) => {
				const fallbacks: Record<string, string> = {
					"errorBoundary.title": "Something went wrong",
					"errorBoundary.reportText": "Please help us improve by reporting this error on our",
					"errorBoundary.githubText": "GitHub Issues page",
					"errorBoundary.copyInstructions":
						"Copy and paste the following error message to include it as part of your submission:",
					"errorBoundary.errorStack": "Error Stack:",
					"errorBoundary.componentStack": "Component Stack:",
				}
				return fallbacks[key] || key
			})

		if (!this.state.error) {
			return this.props.children
		}

		const errorDisplay = this.state.error
		const componentStackDisplay = this.state.componentStack

		const version = process.env.PKG_VERSION || "unknown"

		return (
			<div>
				<h2 className="text-lg font-bold mt-0 mb-2">
					{t("errorBoundary.title")} (v{version})
				</h2>
				<p className="mb-4">
					{t("errorBoundary.reportText")}{" "}
					<a href="https://github.com/JabberwockInc/Jabberwock/issues" target="_blank" rel="noreferrer">
						{t("errorBoundary.githubText")}
					</a>
				</p>
				<p className="mb-2">{t("errorBoundary.copyInstructions")}</p>

				<div className="mb-4">
					<h3 className="text-md font-bold mb-1">{t("errorBoundary.errorStack")}</h3>
					<pre className="p-2 border rounded text-sm overflow-auto">{errorDisplay}</pre>
				</div>

				{componentStackDisplay && (
					<div>
						<h3 className="text-md font-bold mb-1">{t("errorBoundary.componentStack")}</h3>
						<pre className="p-2 border rounded text-sm overflow-auto">{componentStackDisplay}</pre>
					</div>
				)}
			</div>
		)
	}
}

export default ErrorBoundary
