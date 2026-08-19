/**
 * VSCode API Mock - Core definitions
 *
 * This file contains the core interface definitions for the VSCode API mock.
 */

// ============================================================================
// Secret Storage interface (backwards compatibility)
// ============================================================================
export interface SecretStorage {
	get(key: string): Thenable<string | undefined>
	store(key: string, value: string): Thenable<void>
	delete(key: string): Thenable<void>
}

// Import Thenable for SecretStorage interface
import type { Thenable } from "./types.ts"
