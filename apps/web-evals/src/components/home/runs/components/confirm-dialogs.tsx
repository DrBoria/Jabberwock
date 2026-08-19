"use client"

import { LoaderCircle } from "lucide-react"

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui"

type ConfirmDeleteDialogProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description: string
	count: number
	isDeleting: boolean
	onConfirm: () => void
}

export function ConfirmDeleteDialog({
	open,
	onOpenChange,
	title,
	description,
	count,
	isDeleting,
	onConfirm,
}: ConfirmDeleteDialogProps) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						disabled={isDeleting}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
						{isDeleting ? (
							<>
								<LoaderCircle className="h-4 w-4 mr-2 animate-spin" />
								Deleting...
							</>
						) : (
							<>
								Delete {count} run{count !== 1 ? "s" : ""}
							</>
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
