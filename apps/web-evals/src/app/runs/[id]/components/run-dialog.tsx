"use client"

import { LoaderCircle, FileText, Copy, Check } from "lucide-react"

import type { Task } from "@jabberwock/evals"

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	ScrollArea,
	Button,
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui"

import { formatLogContent } from "./run-helpers"

function DialogTaskTitle({ task }: { task: Task }) {
	const passed = task.passed === true
	const failed = task.passed === false
	const statusColor = passed ? "text-green-600" : failed ? "text-red-600" : "text-yellow-500"
	const statusLabel = passed ? "Passed" : failed ? "Failed" : "Running"

	return (
		<DialogTitle className="flex items-center gap-2">
			<FileText className="size-4" />
			{task.language}/{task.exercise}
			{task.iteration > 1 && <span className="text-muted-foreground">(#{task.iteration})</span>}
			<span className={`ml-2 text-sm ${statusColor}`}>({statusLabel})</span>
		</DialogTitle>
	)
}

function DialogCopyButton({
	taskLog,
	copied,
	onCopyLog,
}: {
	taskLog: string | null
	copied: boolean
	onCopyLog: () => void
}) {
	if (!taskLog) return null

	return (
		<Button variant="outline" size="sm" onClick={onCopyLog} className="flex items-center gap-1">
			{copied ? (
				<>
					<Check className="size-4" />
					Copied!
				</>
			) : (
				<>
					<Copy className="size-4" />
					Copy Log
				</>
			)}
		</Button>
	)
}

function DialogLogContent({ isLoadingLog, taskLog }: { isLoadingLog: boolean; taskLog: string | null }) {
	if (isLoadingLog) {
		return (
			<div className="flex items-center justify-center h-full">
				<LoaderCircle className="size-6 animate-spin" />
			</div>
		)
	}

	if (taskLog) {
		return (
			<ScrollArea className="h-full w-full">
				<div className="text-xs font-mono bg-muted p-4 rounded-md overflow-x-auto">
					{formatLogContent(taskLog)}
				</div>
			</ScrollArea>
		)
	}

	return (
		<div className="flex items-center justify-center h-full text-muted-foreground">
			Log file not available (may have been cleared)
		</div>
	)
}

export function RunTaskDialog({
	selectedTask,
	taskLog,
	isLoadingLog,
	copied,
	onCopyLog,
	onClose,
}: {
	selectedTask: Task | null
	taskLog: string | null
	isLoadingLog: boolean
	copied: boolean
	onCopyLog: () => void
	onClose: () => void
}) {
	return (
		<Dialog open={!!selectedTask} onOpenChange={onClose}>
			<DialogContent className="w-[95vw] !max-w-[95vw] h-[90vh] flex flex-col">
				<DialogHeader className="flex-shrink-0">
					<div className="flex items-center justify-between pr-8">
						{selectedTask && <DialogTaskTitle task={selectedTask} />}
						<DialogCopyButton taskLog={taskLog} copied={copied} onCopyLog={onCopyLog} />
					</div>
				</DialogHeader>
				<div className="flex-1 min-h-0 overflow-hidden">
					<DialogLogContent isLoadingLog={isLoadingLog} taskLog={taskLog} />
				</div>
			</DialogContent>
		</Dialog>
	)
}

export function RunKillDialog({
	showKillDialog,
	isKilling,
	onKillRun,
	onClose,
}: {
	showKillDialog: boolean
	isKilling: boolean
	onKillRun: () => void
	onClose: (open: boolean) => void
}) {
	return (
		<AlertDialog open={showKillDialog} onOpenChange={onClose}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Kill Run?</AlertDialogTitle>
					<AlertDialogDescription>
						This will stop the controller and all task runner containers for this run. Any running tasks
						will be terminated immediately. This action cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isKilling}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={onKillRun}
						disabled={isKilling}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
						{isKilling ? (
							<>
								<LoaderCircle className="size-4 animate-spin mr-2" />
								Killing...
							</>
						) : (
							"Kill Run"
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
