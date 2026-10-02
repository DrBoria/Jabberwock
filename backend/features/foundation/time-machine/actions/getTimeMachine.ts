import type { IDiffViewProvider } from "@jabberwock/types"
import type { VirtualWorkspace } from "@features/foundation"
import type { FileContextTracker } from "@features/foundation"

/**
 * Time-machine state: holds references to instances that were previously
 * stored on TaskModel's volatile block. Task startup calls
 * `setTimeMachineState()` to set the current instances; consumers
 * access them via getters instead of reaching through `task.*`.
 *
 * This delegates lifecycle management to the task layer while letting
 * the rest of the codebase remain decoupled from "TaskModel" internals.
 */

interface TimeMachineState {
	/**
	 * Optional: hosts without a `hostEditorService` capability (e.g. the web server) have no diff
	 * view, so this is undefined. `getDiffViewProvider()` throws a descriptive error only when it
	 * is actually accessed (i.e. a tool tries to edit a file), not at task start.
	 */
	diffViewProvider?: IDiffViewProvider
	virtualWorkspace: VirtualWorkspace
	fileContextTracker: FileContextTracker
}

const _tmState = { value: undefined as TimeMachineState | undefined }

/** Set the current time-machine instances (called during task startup). */
export function setTimeMachineState(state: TimeMachineState): void {
	_tmState.value = state
}

/** Clear the stored references (called during task teardown). */
export function clearTimeMachineState(): void {
	_tmState.value = undefined
}

/** Get the current DiffViewProvider instance. */
export function getDiffViewProvider(): IDiffViewProvider {
	if (!_tmState.value) throw new Error("TimeMachine state not initialized — call setTimeMachineState() first")
	if (!_tmState.value.diffViewProvider) {
		throw new Error("DiffViewProvider not available in this host (no hostEditorService capability)")
	}
	return _tmState.value.diffViewProvider
}

/** Get the current VirtualWorkspace instance. */
export function getVirtualWorkspace(): VirtualWorkspace {
	if (!_tmState.value) throw new Error("TimeMachine state not initialized — call setTimeMachineState() first")
	return _tmState.value.virtualWorkspace
}

/** Get the current FileContextTracker instance. */
export function getFileContextTracker(): FileContextTracker {
	if (!_tmState.value) throw new Error("TimeMachine state not initialized — call setTimeMachineState() first")
	return _tmState.value.fileContextTracker
}
