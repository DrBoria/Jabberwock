import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import * as fs from "node:fs"
import * as path from "node:path"
import archiver from "archiver"
import type { Archiver } from "archiver"

import { findRun, getTasks } from "@jabberwock/evals"
import type { Task } from "@jabberwock/evals"

export const dynamic = "force-dynamic"

const LOG_BASE_PATH = "/tmp/evals/runs"

function sanitizePathComponent(component: string): string {
	return component.replace(/[/\\:\0*?"<>|]/g, "_")
}

function addTaskLogFilesToArchive(
	archive: Archiver,
	tasks: Task[],
	logDir: string,
): number {
	const expectedBase = path.resolve(LOG_BASE_PATH)
	let filesAdded = 0

	for (const task of tasks) {
		const safeLanguage = sanitizePathComponent(task.language)
		const safeExercise = sanitizePathComponent(task.exercise)
		const safeIteration = task.iteration

		const logFileName = `${safeLanguage}-${safeExercise}.log`
		const resolvedLogPath = path.resolve(path.join(logDir, logFileName))
		if (resolvedLogPath.startsWith(expectedBase) && fs.existsSync(resolvedLogPath)) {
			archive.file(resolvedLogPath, { name: logFileName })
			filesAdded++
		}

		const apiHistoryFileName = `${safeLanguage}-${safeExercise}.${safeIteration}_api_conversation_history.json`
		const resolvedApiPath = path.resolve(path.join(logDir, apiHistoryFileName))
		if (resolvedApiPath.startsWith(expectedBase) && fs.existsSync(resolvedApiPath)) {
			archive.file(resolvedApiPath, { name: apiHistoryFileName })
			filesAdded++
		}

		const uiMessagesFileName = `${safeLanguage}-${safeExercise}.${safeIteration}_ui_messages.json`
		const resolvedUiPath = path.resolve(path.join(logDir, uiMessagesFileName))
		if (resolvedUiPath.startsWith(expectedBase) && fs.existsSync(resolvedUiPath)) {
			archive.file(resolvedUiPath, { name: uiMessagesFileName })
			filesAdded++
		}
	}

	return filesAdded
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params

	try {
		const runId = Number(id)

		if (isNaN(runId)) {
			return NextResponse.json({ error: "Invalid run ID" }, { status: 400 })
		}

		await findRun(runId)

		const tasks = await getTasks(runId)
		const failedTasks = tasks.filter((task) => task.passed === false)

		if (failedTasks.length === 0) {
			return NextResponse.json({ error: "No failed tasks to export" }, { status: 400 })
		}

		const archive = archiver("zip", { zlib: { level: 9 } })
		const chunks: Buffer[] = []

		archive.on("data", (chunk: Buffer) => {
			chunks.push(chunk)
		})

		let archiveError: Error | null = null
		archive.on("error", (err: Error) => {
			archiveError = err
		})

		const archiveEndPromise = new Promise<void>((resolve, reject) => {
			archive.on("end", resolve)
			archive.on("error", reject)
		})

		const logDir = path.join(LOG_BASE_PATH, String(runId))
		const filesAdded = addTaskLogFilesToArchive(archive, failedTasks, logDir)

		if (filesAdded === 0) {
			archive.abort()
			return NextResponse.json(
				{ error: "No log files found - they may have been cleared from disk" },
				{ status: 404 },
			)
		}

		await archive.finalize()
		await archiveEndPromise

		if (archiveError) {
			throw archiveError
		}

		const zipBuffer = Buffer.concat(chunks)

		return new NextResponse(zipBuffer, {
			status: 200,
			headers: {
				"Content-Type": "application/zip",
				"Content-Disposition": `attachment; filename="run-${runId}-failed-logs.zip"`,
				"Content-Length": String(zipBuffer.length),
			},
		})
	} catch (error) {
		console.error("Error exporting failed logs:", error)

		if (error instanceof Error && error.name === "RecordNotFoundError") {
			return NextResponse.json({ error: "Run not found" }, { status: 404 })
		}

		return NextResponse.json({ error: "Failed to export logs" }, { status: 500 })
	}
}
