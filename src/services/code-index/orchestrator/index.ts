export { CodeIndexOrchestrator } from "./orchestrator"
export type { OrchestratorContext, ScanCallbacks } from "./orchestrator.helpers"
export {
	canStartIndexing,
	createScanCallbacks,
	validateScanResult,
	isAbortError,
	extractErrorMessage,
	extractErrorStack,
	handleIndexingCleanupError,
} from "./orchestrator.helpers"
export {
	handleIndexingError,
	startWatcher,
	handleScanAbort,
	runFullScan,
	runIncrementalScan,
} from "./orchestrator.scan"
