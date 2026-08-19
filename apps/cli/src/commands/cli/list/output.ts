import type { Command } from "@jabberwock/types"
import type { TaskSessionEntry } from "@jabberwock/core/cli"

type CommandLike = Pick<Command, "name" | "source" | "filePath" | "description" | "argumentHint">
type ModeLike = { slug: string; name: string }
type SessionLike = TaskSessionEntry

export function outputJson(data: unknown): void {
	process.stdout.write(JSON.stringify(data, null, 2) + "\n")
}

export function outputCommandsText(commands: CommandLike[]): void {
	for (const command of commands) {
		process.stdout.write(
			`/${command.name} (${command.source})${command.description ? ` - ${command.description}` : ""}\n`,
		)
	}
}

export function outputModesText(modes: ModeLike[]): void {
	for (const mode of modes) {
		process.stdout.write(`${mode.slug}\t${mode.name}\n`)
	}
}

export function outputModelsText(models: Record<string, unknown>): void {
	for (const modelId of Object.keys(models).sort()) {
		process.stdout.write(`${modelId}\n`)
	}
}

export function formatSessionTitle(task: string): string {
	const compact = task.replace(/\s+/g, " ").trim()
	if (!compact) {
		return "(untitled)"
	}
	return compact.length <= 120 ? compact : `${compact.slice(0, 117)}...`
}

export function outputSessionsText(sessions: SessionLike[]): void {
	for (const session of sessions) {
		const startedAt = Number.isFinite(session.ts) ? new Date(session.ts).toISOString() : "unknown-time"
		process.stdout.write(`${session.id}\t${startedAt}\t${formatSessionTitle(session.task)}\n`)
	}
}
