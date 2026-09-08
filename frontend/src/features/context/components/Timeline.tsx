import { observer } from "mobx-react-lite"
import { useEffect, useMemo, useRef } from "react"

import type { HistoryChunkItem } from "@jabberwock/types"
import { contextViewportStore } from "../store-singleton"
import { requestTaskHistory, requestViewportRange } from "../store-singleton"
import { JumpControls } from "./JumpControls"
import { TimelineRow } from "./TimelineRow"

const EST_ROW_H = { message: 80, rollup: 40 } as const
const OVERSCAN = 8
const PREFETCH_EDGE = 180

export interface TimelineProps {
	taskId: string
}

/**
 * Deep-link resolution (spec §7.4): parse `window.location.hash` for
 * `#task=<id>&seq=N[&node=...]`. Returns the anchor seq when the fragment targets
 * THIS task, else undefined (fall back to the fresh tail). The re-fetch is
 * idempotent (spec §7.4) so landing after a reconnect re-resolves to the same row.
 */
function deepLinkAnchor(taskId: string): number | undefined {
	if (typeof window === "undefined") return undefined
	const hash = window.location.hash
	if (!hash.startsWith("#")) return undefined
	try {
		const params = new URLSearchParams(hash.slice(1))
		const targetTask = params.get("task")
		if (targetTask !== null && targetTask !== taskId) return undefined
		const seq = params.get("seq")
		if (seq === null) return undefined
		const n = Number(seq)
		return Number.isFinite(n) && n > 0 ? n : undefined
	} catch {
		return undefined
	}
}

function estHeight(item: HistoryChunkItem): number {
	return item.summaryText !== undefined || item.nodeMeta !== undefined ? EST_ROW_H.rollup : EST_ROW_H.message
}

/**
 * The full-history timeline (spec §7.5, ICG-D1): a scrollable, windowed list over
 * the loaded buffer with on-demand page loads at the edges. Rows are
 * messages / rollup(summaries) / task_embed; expanding a row recalls lossless raw
 * content (incl. thinking sub-panels). The buffer is bounded (we only keep the
 * loaded window), so the DOM stays small; a lightweight offset window renders only
 * the visible slice + overscan.
 */
export const Timeline = observer(function Timeline({ taskId }: { taskId: string }) {
	const containerRef = useRef<HTMLDivElement | null>(null)
	const store = contextViewportStore

	// Initial load: honor a deep-link anchor (spec §7.4) else the fresh tail.
	// (requestTaskHistory calls setCurrentTask, which clears the buffer on switch.)
	useEffect(() => {
		const anchor = deepLinkAnchor(taskId)
		requestTaskHistory(taskId, anchor)
	}, [taskId])

	const seqs = store.sortedSeqs
	const items = useMemo<HistoryChunkItem[]>(() => {
		const out: HistoryChunkItem[] = []
		for (const seq of seqs) {
			const it = store.items.get(String(seq))
			if (it) out.push(it)
		}
		return out
	}, [store, seqs])

	// Cumulative offsets for windowing.
	const { totalHeight, offsets } = useMemo(() => {
		const offs: number[] = new Array(items.length)
		let acc = 0
		for (let i = 0; i < items.length; i++) {
			offs[i] = acc
			acc += estHeight(items[i])
		}
		return { totalHeight: acc, offsets: offs }
	}, [items])

	const scrollTop = store.scrollTop
	const viewport = store.viewportHeight > 0 ? store.viewportHeight : 480

	// Find the visible index window (buffer is bounded, linear scan is fine).
	const [start, end] = useMemo(() => {
		let s = 0
		while (s < items.length - 1 && offsets[s] < scrollTop - OVERSCAN * EST_ROW_H.message) s++
		let e = s
		while (e < items.length - 1 && offsets[e] < scrollTop + viewport + OVERSCAN * EST_ROW_H.message) e++
		return [Math.max(0, s - OVERSCAN), Math.min(items.length - 1, e + OVERSCAN)]
	}, [items, offsets, scrollTop, viewport])

	const onScroll = () => {
		const el = containerRef.current
		if (!el) return
		store.setScroll(el.scrollTop, el.clientHeight)
		const min = store.sortedSeqs[0]
		const max = store.sortedSeqs[store.sortedSeqs.length - 1]
		if (min === undefined || max === undefined) return
		// Near the top → load older page; near the bottom → load newer page.
		if (el.scrollTop < PREFETCH_EDGE) {
			requestViewportRange(taskId, min)
		} else if (el.clientHeight - el.scrollTop < PREFETCH_EDGE) {
			requestViewportRange(taskId, max)
		}
	}

	const visible = items.slice(start, end + 1)
	const topPad = start > 0 ? offsets[start] : 0
	const lastItem = items[end]
	const bottomPad = end < items.length - 1 && lastItem ? totalHeight - (offsets[end] ?? 0) - estHeight(lastItem) : 0

	return (
		<div
			className="context-timeline"
			style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
			<JumpControls
				taskId={taskId}
				onJump={(anchor) => {
					requestViewportRange(taskId, anchor)
					const el = containerRef.current
					if (el) el.scrollTop = 0
					store.setScroll(0, el?.clientHeight ?? 480)
				}}
			/>
			<div
				ref={containerRef}
				onScroll={onScroll}
				className="context-timeline-scroll"
				style={{ flex: 1, overflowY: "auto", minHeight: 0, position: "relative" }}>
				{items.length === 0 ? (
					<div style={{ padding: 16, color: "var(--muted-foreground, #999)", fontSize: 13 }}>
						Loading history…
					</div>
				) : (
					<div style={{ height: totalHeight, position: "relative" }}>
						<div style={{ position: "absolute", top: topPad, left: 0, right: 0 }}>
							{visible.map((it) => (
								<TimelineRow
									key={it.seq}
									item={it}
									nodeId={it.nodeId}
									expanded={it.nodeId ? store.expandedNodes.get(it.nodeId) === true : false}
									recalled={it.nodeId ? store.recalledItems.get(it.nodeId) : undefined}
								/>
							))}
						</div>
						{bottomPad > 0 && <div style={{ height: bottomPad }} />}
					</div>
				)}
			</div>
		</div>
	)
})
