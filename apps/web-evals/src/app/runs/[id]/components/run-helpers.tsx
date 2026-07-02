import type { Task, TaskMetrics as _TaskMetrics } from "@jabberwock/evals"

export type TaskMetrics = Pick<_TaskMetrics, "tokensIn" | "tokensOut" | "tokensContext" | "duration" | "cost">

export type TaskWithMetrics = Task & { taskMetrics: _TaskMetrics | null }

export type ToolUsageEntry = { attempts: number; failures: number }
export type ToolUsage = Record<string, ToolUsageEntry>

export function getToolAbbreviation(toolName: string): string {
	const parts = toolName.split("_")
	const abbreviation = parts.map((word) => word[0]?.toUpperCase() ?? "").join("")
	return abbreviation
}

export type HighlightPattern = {
	pattern: RegExp
	className: string
	wrapGroup?: number
}

export const HIGHLIGHT_PATTERNS: HighlightPattern[] = [
	{ pattern: /\|\s*(INFO)\s*\|/g, className: "text-green-400", wrapGroup: 1 },
	{ pattern: /\|\s*(WARN|WARNING)\s*\|/g, className: "text-yellow-400", wrapGroup: 1 },
	{ pattern: /\|\s*(ERROR)\s*\|/g, className: "text-red-400 font-semibold", wrapGroup: 1 },
	{ pattern: /\|\s*(DEBUG)\s*\|/g, className: "text-gray-400", wrapGroup: 1 },
	{
		pattern: /(taskCreated|taskFocused|taskStarted|taskCompleted|taskAborted|taskResumable)/g,
		className: "text-purple-400 font-medium",
	},
	{ pattern: /(taskToolFailed)/g, className: "text-red-400 font-bold" },
	{ pattern: /(Tool execution failed|tool.*failed|failed.*tool)/gi, className: "text-red-400" },
	{ pattern: /(EvalPass)/g, className: "text-green-400 font-bold" },
	{ pattern: /(EvalFail)/g, className: "text-red-400 font-bold" },
	{ pattern: /→/g, className: "text-cyan-400" },
	{ pattern: /"(tool)":\s*"([^"]+)"/g, className: "text-orange-400" },
	{ pattern: /"([^"]+)":/g, className: "text-sky-300" },
	{ pattern: /:\s*(true|false)/g, className: "text-amber-400", wrapGroup: 1 },
	{ pattern: /:\s*(-?\d+\.?\d*)/g, className: "text-emerald-400", wrapGroup: 1 },
]

type Match = { start: number; end: number; text: string; className: string }

function collectHighlightMatches(line: string): Match[] {
	const matches: Match[] = []

	for (const { pattern, className, wrapGroup } of HIGHLIGHT_PATTERNS) {
		pattern.lastIndex = 0
		let regexMatch
		while ((regexMatch = pattern.exec(line)) !== null) {
			const capturedText = wrapGroup !== undefined ? regexMatch[wrapGroup] : regexMatch[0]
			if (!capturedText) continue
			const start =
				wrapGroup !== undefined ? regexMatch.index + regexMatch[0].indexOf(capturedText) : regexMatch.index
			matches.push({ start, end: start + capturedText.length, text: capturedText, className })
		}
	}

	return matches
}

function filterOverlappingMatches(matches: Match[]): Match[] {
	matches.sort((a, b) => a.start - b.start)
	const filtered: Match[] = []
	for (const m of matches) {
		const lastMatch = filtered[filtered.length - 1]
		if (!lastMatch || m.start >= lastMatch.end) {
			filtered.push(m)
		}
	}
	return filtered
}

function buildHighlightedResult(line: string, matches: Match[]): React.ReactNode[] {
	const result: React.ReactNode[] = []
	let currentPos = 0

	for (const [i, m] of matches.entries()) {
		if (m.start > currentPos) {
			result.push(line.slice(currentPos, m.start))
		}
		result.push(
			<span key={`${i}-${m.start}`} className={m.className}>
				{m.text}
			</span>,
		)
		currentPos = m.end
	}

	if (currentPos < line.length) {
		result.push(line.slice(currentPos))
	}

	return result.length > 0 ? result : [line]
}

export function formatLine(line: string): React.ReactNode[] {
	const matches = collectHighlightMatches(line)
	const filteredMatches = filterOverlappingMatches(matches)
	return buildHighlightedResult(line, filteredMatches)
}

const LINE_STYLE_RULES: Array<{ pattern: string; className: string }> = [
	{ pattern: "ERROR", className: "bg-red-950/30 border-l-2 border-red-500" },
	{ pattern: "WARN", className: "bg-yellow-950/20 border-l-2 border-yellow-500" },
	{ pattern: "taskToolFailed", className: "bg-red-950/30 border-l-2 border-red-500" },
	{ pattern: "taskStarted", className: "bg-purple-950/20" },
	{ pattern: "EvalPass", className: "bg-green-950/30 border-l-2 border-green-500" },
	{ pattern: "EvalFail", className: "bg-red-950/30 border-l-2 border-red-500" },
	{ pattern: "taskCompleted", className: "bg-blue-950/20" },
]

export function getLineStyle(line: string): string {
	// WARNING must be checked after ERROR to avoid false match on "WARNING" prefix
	if (line.includes("WARNING") && !line.includes("ERROR")) {
		return "bg-yellow-950/20 border-l-2 border-yellow-500"
	}
	// taskAborted must be checked after taskToolFailed (contains "aborted")
	if (line.includes("taskAborted") && !line.includes("taskToolFailed")) {
		return "bg-blue-950/20"
	}
	for (const rule of LINE_STYLE_RULES) {
		if (line.includes(rule.pattern)) return rule.className
	}
	return ""
}

export function formatElapsedTime(timestamp: string, baselineMs: number): string {
	const currentMs = new Date(timestamp).getTime()
	const elapsedMs = currentMs - baselineMs
	const totalSeconds = Math.floor(elapsedMs / 1000)
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

export function extractFirstTimestamp(log: string): number | null {
	const match = log.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)[\s|\]]/)
	const isoString = match?.[1]
	if (!isoString) return null
	return new Date(isoString).getTime()
}

export function simplifyLogLine(line: string, baselineMs: number | null): { timestamp: string; simplified: string } {
	const timestampMatch = line.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)[\s|\]]/)
	const isoTimestamp = timestampMatch?.[1]
	if (!isoTimestamp) {
		return { timestamp: "", simplified: line }
	}

	const timestamp = baselineMs !== null ? formatElapsedTime(isoTimestamp, baselineMs) : isoTimestamp.slice(11, 19)

	let simplified = line.replace(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\s*\|?\s*/, "")
	simplified = simplified.replace(/\|\s*pid:\d+\s*/g, "")
	simplified = simplified.replace(/\|\s*run:\d+\s*/g, "")
	simplified = simplified.replace(/\|\s*task:\d+\s*/g, "")
	simplified = simplified.replace(/runTask\s*\|\s*/g, "")
	simplified = simplified.replace(/\|\s*\|/g, "|")
	simplified = simplified.replace(/^\s*\|\s*/, "")
	simplified = simplified.replace(/\]\s*$/, "")

	return { timestamp, simplified }
}

export function formatLogContent(log: string): React.ReactNode[] {
	const lines = log.split("\n")
	const baselineMs = extractFirstTimestamp(log)

	return lines.map((line, index) => {
		if (!line.trim()) {
			return (
				<div key={index} className="h-2">
					{" "}
				</div>
			)
		}

		const parsed = simplifyLogLine(line, baselineMs)
		const lineStyle = getLineStyle(line)

		return (
			<div key={index} className={`flex hover:bg-white/10 py-0.5 rounded-sm transition-colors ${lineStyle}`}>
				<span className="text-blue-400 font-mono w-12 flex-shrink-0 tabular-nums text-right pr-2">
					{parsed.timestamp}
				</span>
				<span className="flex-1 break-words" style={{ textIndent: "-0.5rem", paddingLeft: "0.5rem" }}>
					{formatLine(parsed.simplified)}
				</span>
			</div>
		)
	})
}

export function calculateDurationFromTimestamps(task: TaskWithMetrics): number {
	if (!task.startedAt) return 0
	const startTime = new Date(task.startedAt).getTime()
	const endTime = task.finishedAt ? new Date(task.finishedAt).getTime() : Date.now()
	return endTime - startTime
}

export function resolveTaskToolUsage(
	task: TaskWithMetrics,
	toolUsage: Map<number, ToolUsage | undefined>,
): ToolUsage | undefined {
	const dbToolUsage = task.taskMetrics?.toolUsage
	const streamingToolUsage = toolUsage.get(task.id)
	return task.finishedAt
		? dbToolUsage && Object.keys(dbToolUsage).length > 0
			? (dbToolUsage as unknown as ToolUsage)
			: streamingToolUsage
		: streamingToolUsage
}

export function getSuccessRateColor(successRate: number): string {
	if (successRate === 100) return "text-muted-foreground"
	if (successRate >= 80) return "text-yellow-500"
	return "text-red-500"
}

export function getSuccessRate(usage: { attempts: number; failures: number }): number {
	return usage.attempts > 0 ? ((usage.attempts - usage.failures) / usage.attempts) * 100 : 100
}
