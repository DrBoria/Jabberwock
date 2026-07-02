import type { DiffViewProvider } from "@integrations/editor/DiffViewProvider"
import type { VirtualWorkspace } from "@features/foundation/time-machine/VirtualWorkspace"
import type { FileContextTracker } from "@features/foundation/time-machine/file-context/FileContextTracker"

/**
 * Time-machine state: holds references to instances that were previously
 * stored on TaskModel's volatile block. Task startup calls
 * `setTimeMachineState()` to set the current instances; consumers
 * access them via getters instead of reaching through `task.*`.
 *
 * This delegates lifecycle management to the task layer while letting
 * the rest of the codebase remain decoupled from TaskModel internals.
 */

interface TimeMachineState {
	diffViewProvider: DiffViewProvider
	virtualWorkspace: VirtualWorkspace
	fileContextTracker: FileContextTracker
}

let _state: TimeMachineState | undefined

/** Set the current time-machine instances (called during task startup). */
export function setTimeMachineState(state: TimeMachineState): void {
	_state = state
}

/** Clear the stored references (called during task teardown). */
export function clearTimeMachineState(): void {
	_state = undefined
}

/** Get the current DiffViewProvider instance. */
export function getDiffViewProvider(): DiffViewProvider {
	if (!_state) throw new Error("TimeMachine state not initialized — call setTimeMachineState() first")
	return _state.diffViewProvider
}

/** Get the current VirtualWorkspace instance. */
export function getVirtualWorkspace(): VirtualWorkspace {
	if (!_state) throw new Error("TimeMachine state not initialized — call setTimeMachineState() first")
	return _state.virtualWorkspace
}

/** Get the current FileContextTracker instance. */
export function getFileContextTracker(): FileContextTracker {
	if (!_state) throw new Error("TimeMachine state not initialized — call setTimeMachineState() first")
	return _state.fileContextTracker
}
