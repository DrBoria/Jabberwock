"use client"

import { useCallback, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { deleteRun, updateRunDescription } from "@/actions/runs"
import { useCopyRun } from "@/hooks/use-copy-run"
import type { Run as EvalsRun } from "@jabberwock/evals"

export function useRunActions(run: EvalsRun) {
	const router = useRouter()
	const [deleteRunId, setDeleteRunId] = useState<number>()
	const [showSettings, setShowSettings] = useState(false)
	const [isExportingLogs, setIsExportingLogs] = useState(false)
	const [showNotesDialog, setShowNotesDialog] = useState(false)
	const [editingDescription, setEditingDescription] = useState(run.description ?? "")
	const [isSavingNotes, setIsSavingNotes] = useState(false)
	const continueRef = useRef<HTMLButtonElement>(null)
	const { isPending, copyRun, copied } = useCopyRun(run.id)

	const hasDescription = Boolean(run.description && run.description.trim().length > 0)

	const handleSaveDescription = useCallback(async () => {
		setIsSavingNotes(true)
		try {
			const result = await updateRunDescription(run.id, editingDescription.trim() || null)
			if (result.success) {
				toast.success("Description saved")
				setShowNotesDialog(false)
				router.refresh()
			} else {
				toast.error("Failed to save description")
			}
		} catch {
			toast.error("Failed to save description")
		} finally {
			setIsSavingNotes(false)
		}
	}, [run.id, editingDescription, router])

	const onExportFailedLogs = useCallback(async () => {
		if (run.failed === 0) {
			toast.error("No failed tasks to export")
			return
		}
		setIsExportingLogs(true)
		try {
			const response = await fetch(`/api/runs/${run.id}/logs/failed`)
			if (!response.ok) {
				const error = await response.json()
				toast.error(error.error || "Failed to export logs")
				return
			}
			const blob = await response.blob()
			const url = window.URL.createObjectURL(blob)
			const a = document.createElement("a")
			a.href = url
			a.download = `run-${run.id}-failed-logs.zip`
			document.body.appendChild(a)
			a.click()
			window.URL.revokeObjectURL(url)
			document.body.removeChild(a)
			toast.success("Failed logs exported successfully")
		} catch {
			toast.error("Failed to export logs")
		} finally {
			setIsExportingLogs(false)
		}
	}, [run.id, run.failed])

	const onConfirmDelete = useCallback(async () => {
		if (!deleteRunId) return
		try {
			await deleteRun(deleteRunId)
			setDeleteRunId(undefined)
		} catch (error) {
			console.error(error)
		}
	}, [deleteRunId])

	const handleRowClick = useCallback(
		(e: React.MouseEvent) => {
			if ((e.target as HTMLElement).closest("[data-dropdown-trigger]")) return
			router.push(`/runs/${run.id}`)
		},
		[router, run.id],
	)

	return {
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
		handleRowClick,
	}
}
