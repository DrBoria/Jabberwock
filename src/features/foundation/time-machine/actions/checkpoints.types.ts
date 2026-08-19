export type CheckpointRestoreOptions = {
	ts: number
	commitHash: string
	mode: "preview" | "restore"
	operation?: "delete" | "edit"
}

export type CheckpointDiffOptions = {
	ts?: number
	previousCommitHash?: string
	commitHash: string
	mode: "from-init" | "checkpoint" | "to-current" | "full"
}
