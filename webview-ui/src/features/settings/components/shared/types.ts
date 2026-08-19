import type { ExperimentId, ExtensionState } from "@jabberwock/types"

export type SetCachedStateField<K extends keyof ExtensionState> = (field: K, value: ExtensionState[K]) => void

export type SetExperimentEnabled = (id: ExperimentId, enabled: boolean) => void
