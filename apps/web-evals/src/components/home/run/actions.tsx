"use client"

import Link from "next/link"
import { Ellipsis, ClipboardList, StickyNote, Settings, Trash } from "lucide-react"

import type { Run as EvalsRun } from "@jabberwock/evals"

import {
	Button,
	Textarea,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	ScrollArea,
} from "@/components/ui"

import { CopyRunMenuItem, ExportLogsMenuItem, NoteButtonLabel } from "./actions-components"

type RunActionsProps = {
	run: EvalsRun
	deleteRunId: number | undefined
	setDeleteRunId: (id: number | undefined) => void
	showSettings: boolean
	setShowSettings: (open: boolean) => void
	isExportingLogs: boolean
	showNotesDialog: boolean
	setShowNotesDialog: (open: boolean) => void
	editingDescription: string
	setEditingDescription: (value: string) => void
	isSavingNotes: boolean
	continueRef: React.RefObject<HTMLButtonElement | null>
	isPending: boolean
	copyRun: () => void
	copied: boolean
	hasDescription: boolean
	handleSaveDescription: () => void
	onExportFailedLogs: () => void
	onConfirmDelete: () => void
}

export function RunActions({
	run,
	deleteRunId,
	setDeleteRunId,
	showSettings,
	setShowSettings,
	isExportingLogs,
	showNotesDialog,
	setShowNotesDialog,
	editingDescription,
	setEditingDescription,
	isSavingNotes,
	continueRef,
	isPending,
	copyRun,
	copied,
	hasDescription,
	handleSaveDescription,
	onExportFailedLogs,
	onConfirmDelete,
}: RunActionsProps) {
	return (
		<div className="flex items-center gap-1">
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className={hasDescription ? "" : "opacity-30 hover:opacity-60"}
						onClick={(e) => {
							e.stopPropagation()
							setEditingDescription(run.description ?? "")
							setShowNotesDialog(true)
						}}>
						<StickyNote className="h-4 w-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent className="max-w-[300px]">
					{hasDescription ? (
						<div className="whitespace-pre-wrap">{run.description}</div>
					) : (
						<div className="text-muted-foreground">No description. Click to add one.</div>
					)}
				</TooltipContent>
			</Tooltip>

			<DropdownMenu>
				<Button variant="ghost" size="icon" asChild>
					<DropdownMenuTrigger data-dropdown-trigger>
						<Ellipsis />
					</DropdownMenuTrigger>
				</Button>
				<DropdownMenuContent align="end">
					<DropdownMenuItem asChild>
						<Link href={`/runs/${run.id}`}>
							<div className="flex items-center gap-1">
								<ClipboardList />
								<div>View Tasks</div>
							</div>
						</Link>
					</DropdownMenuItem>
					{run.settings && (
						<DropdownMenuItem onClick={() => setShowSettings(true)}>
							<div className="flex items-center gap-1">
								<Settings />
								<div>View Settings</div>
							</div>
						</DropdownMenuItem>
					)}
					{run.taskMetricsId && (
						<DropdownMenuItem onClick={() => copyRun()} disabled={isPending || copied}>
							<div className="flex items-center gap-1">
								<CopyRunMenuItem isPending={isPending} copied={copied} />
							</div>
						</DropdownMenuItem>
					)}
					{run.failed > 0 && (
						<DropdownMenuItem onClick={onExportFailedLogs} disabled={isExportingLogs}>
							<div className="flex items-center gap-1">
								<ExportLogsMenuItem isExportingLogs={isExportingLogs} />
							</div>
						</DropdownMenuItem>
					)}
					<DropdownMenuItem
						onClick={() => {
							setDeleteRunId(run.id)
							setTimeout(() => continueRef.current?.focus(), 0)
						}}>
						<div className="flex items-center gap-1">
							<Trash />
							<div>Delete</div>
						</div>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<AlertDialog open={!!deleteRunId} onOpenChange={() => setDeleteRunId(undefined)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you sure?</AlertDialogTitle>
						<AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction ref={continueRef as React.Ref<HTMLButtonElement>} onClick={onConfirmDelete}>
							Continue
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Dialog open={showSettings} onOpenChange={setShowSettings}>
				<DialogContent className="max-w-2xl max-h-[80vh]">
					<DialogHeader>
						<DialogTitle>Run Settings</DialogTitle>
					</DialogHeader>
					<ScrollArea className="max-h-[60vh]">
						<pre className="text-xs font-mono bg-muted p-4 rounded-md overflow-auto">
							{JSON.stringify(run.settings, null, 2)}
						</pre>
					</ScrollArea>
				</DialogContent>
			</Dialog>

			<Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>Run Description</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<Textarea
							placeholder="Add a description or notes for this run..."
							value={editingDescription}
							onChange={(e) => setEditingDescription(e.target.value)}
							rows={4}
							className="resize-none"
						/>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowNotesDialog(false)}>
							Cancel
						</Button>
						<Button onClick={handleSaveDescription} disabled={isSavingNotes}>
							<NoteButtonLabel isSavingNotes={isSavingNotes} />
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
