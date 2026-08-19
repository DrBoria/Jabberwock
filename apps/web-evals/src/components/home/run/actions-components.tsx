"use client"

import { LoaderCircle, Check, Copy, FileDown } from "lucide-react"

export function CopyRunMenuItem({ isPending, copied }: { isPending: boolean; copied: boolean }) {
	if (isPending) {
		return (
			<>
				<LoaderCircle className="animate-spin" />
				Copying...
			</>
		)
	}
	if (copied) {
		return (
			<>
				<Check />
				Copied!
			</>
		)
	}
	return (
		<>
			<Copy />
			Copy to Production
		</>
	)
}

export function ExportLogsMenuItem({ isExportingLogs }: { isExportingLogs: boolean }) {
	if (isExportingLogs) {
		return (
			<>
				<LoaderCircle className="animate-spin" />
				Exporting...
			</>
		)
	}
	return (
		<>
			<FileDown />
			Export Failed Logs
		</>
	)
}

export function NoteButtonLabel({ isSavingNotes }: { isSavingNotes: boolean }) {
	if (isSavingNotes) {
		return (
			<>
				<LoaderCircle className="h-4 w-4 mr-2 animate-spin" />
				Saving...
			</>
		)
	}
	return <>Save</>
}
