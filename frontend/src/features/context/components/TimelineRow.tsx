import { memo } from "react"
import { ChevronDown, ChevronUp, Boxes, MessageSquare } from "lucide-react"

import type { ContextNodeMeta, HistoryChunkItem, RecallItem } from "@jabberwock/types"
import { contextViewportStore } from "../store-singleton"
import { recallNode } from "../actions"
import { ThinkingPanel } from "./ThinkingPanel"

/** Extract a short human-readable body from a partsJson payload for inline display. */
function summarizeText(partsJson: string | undefined): string {
	if (!partsJson) return ""
	try {
		const parsed = JSON.parse(partsJson) as unknown
		if (Array.isArray(parsed)) {
			return (parsed as { text?: string; content?: string }[])
				.map((p) => (typeof p?.text === "string" ? p.text : typeof p?.content === "string" ? p.content : ""))
				.filter(Boolean)
				.join("\n")
		}
		if (typeof parsed === "string") return parsed
		return partsJson
	} catch {
		return partsJson
	}
}

function metaChip(meta: ContextNodeMeta): string {
	const { fromSeq, toSeq } = meta.range
	const rangeLabel = fromSeq === toSeq ? `#${fromSeq}` : `#${fromSeq}–#${toSeq}`
	const descendants = meta.descendantCount !== undefined ? ` · ${meta.descendantCount} msgs` : ""
	return `${rangeLabel}${descendants}`
}

export interface TimelineRowProps {
	item: HistoryChunkItem
	nodeId?: string
	expanded?: boolean
	recalled?: RecallItem[]
}

/**
 * One row of the full-history timeline (spec §7.5):
 *  - message rows: role chip + body (fresh tail / recall content)
 *  - rollup/summary rows: 1–2 line summaryText + metadata chip + expand affordance
 *  - task_embed rows: status marker + completion summary
 * Expanding a row fires `context.recall.requested(nodeId)` (spec §7.5) and renders
 * the lossless raw content (including thinking sub-panels) progressively.
 */
/** Rollup / summary row (compressed region marker, collapsed state). */
function RollupRow({ item, onToggle }: { item: HistoryChunkItem; onToggle: () => void }) {
	return (
		<div
			className="context-timeline-row context-timeline-row-rollup"
			style={{ padding: "6px 10px", opacity: 0.92 }}>
			<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
				<Boxes size={14} />
				<span style={{ fontSize: 13, flex: 1 }}>{item.summaryText ?? "(rollup)"}</span>
				{item.nodeMeta && (
					<span
						style={{
							fontSize: 11,
							color: "var(--muted-foreground, #999)",
							border: "1px solid var(--border, #333)",
							borderRadius: 4,
							padding: "1px 5px",
						}}>
						{metaChip(item.nodeMeta)}
					</span>
				)}
				<button
					type="button"
					onClick={onToggle}
					title="Expand"
					style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}>
					<ChevronDown size={16} />
				</button>
			</div>
		</div>
	)
}

/** Task embed row (subtask marker, collapsed state). */
function EmbedRow({ item, onToggle }: { item: HistoryChunkItem; onToggle: () => void }) {
	return (
		<div className="context-timeline-row context-timeline-row-embed" style={{ padding: "6px 10px", opacity: 0.9 }}>
			<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
				<Boxes size={14} />
				<span style={{ fontSize: 13, flex: 1 }}>{item.summaryText ?? "subtask"}</span>
				{item.nodeMeta && (
					<span style={{ fontSize: 11, color: "var(--muted-foreground, #999)" }}>
						{metaChip(item.nodeMeta)}
					</span>
				)}
				<button
					type="button"
					onClick={onToggle}
					title="Recall"
					style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}>
					<ChevronDown size={16} />
				</button>
			</div>
		</div>
	)
}

/** Message row (or expanded rollup/embed showing recall content). */
function MessageRow({ item, nodeId, expanded, recalled, onToggle }: TimelineRowProps & { onToggle: () => void }) {
	const body = expanded && recalled && recalled.length > 0 ? null : summarizeText(item.partsJson)
	return (
		<div
			className="context-timeline-row context-timeline-row-message"
			style={{ padding: "6px 10px", display: "flex", gap: 8 }}>
			<span
				style={{
					fontSize: 10,
					textTransform: "uppercase",
					letterSpacing: 0.4,
					color: "var(--muted-foreground, #999)",
					minWidth: 64,
					display: "flex",
					alignItems: "flex-start",
					gap: 4,
					paddingTop: 2,
				}}>
				<MessageSquare size={12} />
				{item.role}
			</span>
			<div style={{ flex: 1, minWidth: 0 }}>
				{expanded ? (
					<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
						{(recalled ?? []).map((r) => (
							<div key={r.seq} style={{ borderLeft: "2px solid var(--border, #333)", paddingLeft: 8 }}>
								<span style={{ fontSize: 11, color: "var(--muted-foreground, #888)" }}>
									#{r.seq} · {r.role}
								</span>
								<ThinkingPanel partsJson={r.partsJson} />
							</div>
						))}
					</div>
				) : (
					<div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{body}</div>
				)}
				{nodeId && (
					<button
						type="button"
						onClick={onToggle}
						style={{
							background: "none",
							border: "none",
							cursor: "pointer",
							color: "var(--muted-foreground, #999)",
							fontSize: 11,
							marginTop: 4,
							display: "flex",
							alignItems: "center",
							gap: 4,
						}}>
						{expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
						{expanded ? "collapse" : "expand"}
					</button>
				)}
			</div>
		</div>
	)
}

export const TimelineRow = memo(function TimelineRow({ item, nodeId, expanded, recalled }: TimelineRowProps) {
	const isRollup = item.summaryText !== undefined || item.nodeMeta !== undefined
	const isTaskEmbed = item.nodeId?.startsWith("task_embed") ?? false

	const toggle = () => {
		if (!nodeId) return
		if (!contextViewportStore.expandedNodes.has(nodeId)) {
			// Lazily fetch raw content on first expand (spec §7.5 recall path).
			recallNode({ nodeId })
		}
		contextViewportStore.toggleNode(nodeId)
	}

	if (isRollup && !expanded) {
		return <RollupRow item={item} onToggle={toggle} />
	}
	if (isTaskEmbed && !expanded) {
		return <EmbedRow item={item} onToggle={toggle} />
	}
	return <MessageRow item={item} nodeId={nodeId} expanded={expanded} recalled={recalled} onToggle={toggle} />
})
