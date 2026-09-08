import { observer } from "mobx-react-lite"

import { contextViewportStore } from "../store-singleton"

export interface JumpControlsProps {
	taskId: string
	onJump: (anchorSeq: number) => void
}

/**
 * Jump-to controls (spec §7.5): beginning / middle / end + a position indicator
 * "seq N of ~M". Jumps issue a bounded history-range request at the target anchor.
 */
export const JumpControls = observer(function JumpControls({ taskId, onJump }: JumpControlsProps) {
	const bounds = contextViewportStore.bounds.get(taskId)
	const total = bounds?.totalCount ?? 0
	const anchorSeq = contextViewportStore.sortedSeqs.length > 0 ? contextViewportStore.sortedSeqs[0] : 0

	const btn = (label: string, anchor: number | undefined, disabled: boolean) => (
		<button
			type="button"
			disabled={disabled || anchor === undefined}
			onClick={() => anchor !== undefined && onJump(anchor)}
			style={{
				fontSize: 12,
				padding: "3px 8px",
				borderRadius: 4,
				border: "1px solid var(--border, #333)",
				background: "var(--secondary, #1e1e1e)",
				color: "inherit",
				cursor: disabled ? "not-allowed" : "pointer",
				opacity: disabled ? 0.5 : 1,
			}}>
			{label}
		</button>
	)

	if (!bounds) {
		return (
			<div style={{ padding: "4px 10px", fontSize: 12, color: "var(--muted-foreground, #888)" }}>
				No history loaded yet
			</div>
		)
	}

	const atEnd = anchorSeq >= bounds.maxSeq
	const atBeginning = anchorSeq <= bounds.minSeq
	const middle = Math.round((bounds.minSeq + bounds.maxSeq) / 2)

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 8,
				padding: "6px 10px",
				borderBottom: "1px solid var(--border, #333)",
			}}>
			{btn("⏮ beginning", bounds.minSeq, atBeginning)}
			{btn("middle", middle, false)}
			{btn("end ⏭", bounds.maxSeq, atEnd)}
			<span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted-foreground, #999)" }}>
				seq {anchorSeq} of ~{total}
			</span>
		</div>
	)
})
