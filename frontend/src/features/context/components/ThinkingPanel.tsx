import { memo, useState } from "react"
import { ChevronRight, Brain } from "lucide-react"

/**
 * A single parsed content part from a `partsJson` payload (spec §6.4 — verbatim
 * structured parts including thinking blocks). The backend stores the byte-for-byte
 * API payload; we parse it defensively because part shapes vary by provider.
 */
interface ContentPart {
	type?: string
	text?: string
	thinking?: string
	/** Providers vary: some put the body under `text`, some under `content`. */
	content?: string
}

/** Parse a `partsJson` string into content parts, falling back to a single text part. */
function parseParts(partsJson: string | undefined): ContentPart[] {
	if (!partsJson) return []
	try {
		const parsed = JSON.parse(partsJson) as unknown
		if (Array.isArray(parsed)) return parsed as ContentPart[]
		// Some payloads wrap the parts in an object.
		if (parsed && typeof parsed === "object" && Array.isArray((parsed as { parts?: unknown[] }).parts)) {
			return (parsed as { parts: ContentPart[] }).parts
		}
		if (typeof parsed === "string") return [{ type: "text", text: parsed }]
		return [{ type: "text", text: partsJson }]
	} catch {
		return [{ type: "text", text: partsJson }]
	}
}

export interface ThinkingPanelProps {
	partsJson?: string
	/** Default-collapse thinking blocks (spec §7.5 — watch/phone). */
	defaultCollapsed?: boolean
}

/**
 * Renders the structured parts of a recall item, isolating reasoning/thinking
 * blocks into distinct collapsible sub-panels (spec §7.5). Non-thinking parts are
 * rendered inline as text.
 */
export const ThinkingPanel = memo(function ThinkingPanel({ partsJson, defaultCollapsed = true }: ThinkingPanelProps) {
	const [expanded, setExpanded] = useState(!defaultCollapsed)
	const parts = parseParts(partsJson)
	const thinkingParts = parts.filter((p) => p.type === "thinking" || p.thinking)
	const textParts = parts.filter((p) => !(p.type === "thinking" || p.thinking))

	if (parts.length === 0) {
		return null
	}

	return (
		<div className="context-thinking-panel" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
			{thinkingParts.length > 0 && (
				<div style={{ border: "1px solid var(--border, #333)", borderRadius: 6, overflow: "hidden" }}>
					<button
						type="button"
						onClick={() => setExpanded((v) => !v)}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 6,
							width: "100%",
							padding: "6px 8px",
							background: "var(--secondary, #1e1e1e)",
							border: "none",
							color: "inherit",
							cursor: "pointer",
							fontSize: 12,
							textAlign: "left",
						}}>
						<ChevronRight size={14} style={{ transform: expanded ? "rotate(90deg)" : "none" }} />
						<Brain size={14} />
						<span>Thinking</span>
					</button>
					{expanded && (
						<pre
							style={{
								margin: 0,
								padding: "8px",
								whiteSpace: "pre-wrap",
								fontFamily: "var(--font-mono, monospace)",
								fontSize: 12,
								color: "var(--muted-foreground, #aaa)",
							}}>
							{thinkingParts.map((p) => p.thinking ?? p.text ?? p.content ?? "").join("\n\n")}
						</pre>
					)}
				</div>
			)}
			{textParts.length > 0 && (
				<div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
					{textParts.map((p) => p.text ?? p.content ?? "")}
				</div>
			)}
		</div>
	)
})
