import { useState, useEffect, useCallback, useMemo } from "react"
import { CornerDownRight, Folder, FolderSearch } from "lucide-react"
import { rootStore } from "@src/features/store"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Button } from "@src/shared/ui/buttons/button"
import { Input } from "@src/shared/ui/inputs/input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@src/shared/ui/overlays/dialog"
import { SearchableSelect, type SearchableSelectOption } from "@src/shared/ui/selects/searchable-select"
import type { WorktreeDefaultsResponse, BranchInfo, WorktreeIncludeStatus } from "@jabberwock/types"
import { WarningBanner } from "./WarningBanner"
import { ErrorBanner } from "./ErrorBanner"
import { ProgressSection } from "./ProgressSection"
import { handleWorktreeMessage } from "./messageHandlers"
import type { CreateWorktreeModalProps, MessageState } from "./types"

export const CreateWorktreeModal = ({
	open,
	onClose,
	openAfterCreate = false,
	onSuccess,
}: CreateWorktreeModalProps) => {
	const { t } = useAppTranslation()
	const [branchName, setBranchName] = useState("")
	const [worktreePath, setWorktreePath] = useState("")
	const [baseBranch, setBaseBranch] = useState("")
	const [defaults, setDefaults] = useState<WorktreeDefaultsResponse | null>(null)
	const [branches, setBranches] = useState<BranchInfo | null>(null)
	const [includeStatus, setIncludeStatus] = useState<WorktreeIncludeStatus | null>(null)
	const [isCreating, setIsCreating] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [copyProgress, setCopyProgress] = useState<{ bytesCopied: number; itemName: string } | null>(null)

	useEffect(() => {
		if (open) {
			rootStore.settings.getWorktreeDefaults()
			rootStore.settings.getAvailableBranches()
			rootStore.settings.getWorktreeIncludeStatus()
		}
	}, [open])

	useEffect(() => {
		const state: MessageState = {
			setDefaults,
			setBranchName,
			setWorktreePath,
			setBranches,
			setBaseBranch,
			setIncludeStatus,
			setCopyProgress,
			setIsCreating,
			setError,
			openAfterCreate,
			worktreePath,
			onSuccess,
			onClose,
		}
		const handler = (event: MessageEvent) => {
			handleWorktreeMessage(event, state)
		}
		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [openAfterCreate, worktreePath, onSuccess, onClose])

	const handleCreate = useCallback(() => {
		setError(null)
		setIsCreating(true)
		rootStore.settings.createWorktree(worktreePath, branchName, baseBranch, true)
	}, [worktreePath, branchName, baseBranch])

	const hasBranchName = branchName.trim().length > 0
	const hasWorktreePath = worktreePath.trim().length > 0
	const hasBaseBranch = baseBranch.trim().length > 0
	const isValid = hasBranchName && hasWorktreePath && hasBaseBranch
	const showNoIncludeWarning = includeStatus !== null && includeStatus.exists === false
	const showBranchLoading = branches === null
	const showError = error !== null
	const showProgress = copyProgress !== null
	const branchPlaceholder = defaults !== null ? defaults.suggestedBranch : "worktree/feature-name"
	const pathPlaceholder = defaults !== null ? defaults.suggestedPath : "/path/to/worktree"

	const branchOptions = useMemo((): SearchableSelectOption[] => {
		if (!branches) return []
		const localOptions: SearchableSelectOption[] = branches.localBranches.map((branch) => ({
			value: branch,
			label: branch,
			icon: <span className="codicon codicon-git-branch mr-2 text-vscode-descriptionForeground" />,
		}))
		const remoteOptions: SearchableSelectOption[] = branches.remoteBranches.map((branch) => ({
			value: branch,
			label: branch,
			icon: <span className="codicon codicon-cloud mr-2 text-vscode-descriptionForeground" />,
		}))
		return [...localOptions, ...remoteOptions]
	}, [branches])

	return (
		<Dialog open={open} onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>{t("worktrees:createWorktree")}</DialogTitle>
				</DialogHeader>
				<div className="flex flex-col gap-3">
					<WarningBanner show={showNoIncludeWarning} t={t} />
					<div className="flex flex-col gap-1">
						<label className="text-sm text-vscode-foreground">{t("worktrees:baseBranch")}</label>
						{showBranchLoading ? (
							<div className="flex items-center gap-2 h-8 px-2 text-sm text-vscode-descriptionForeground">
								<span className="codicon codicon-loading codicon-modifier-spin" />
								<span>{t("worktrees:loadingBranches")}</span>
							</div>
						) : (
							<SearchableSelect
								value={baseBranch}
								onValueChange={setBaseBranch}
								options={branchOptions}
								placeholder={t("worktrees:selectBranch")}
								searchPlaceholder={t("worktrees:searchBranch")}
								emptyMessage={t("worktrees:noBranchFound")}
							/>
						)}
					</div>
					<div className="flex items-center gap-2">
						<CornerDownRight className="size-4 ml-2 shrink-0" />
						<label className="text-sm text-vscode-foreground shrink-0">{t("worktrees:branchName")}</label>
						<Input
							value={branchName}
							onChange={(e) => setBranchName(e.target.value)}
							placeholder={branchPlaceholder}
							className="rounded-full"
						/>
					</div>
					<div className="flex items-center gap-2 relative">
						<Folder className="size-4 ml-2 shrink-0" />
						<label className="text-sm text-vscode-foreground shrink-0">{t("worktrees:worktreePath")}</label>
						<Input
							value={worktreePath}
							onChange={(e) => setWorktreePath(e.target.value)}
							placeholder={pathPlaceholder}
							className="rounded-full flex-1 pr-9"
						/>
						<FolderSearch
							className="size-4 shrink-0 absolute right-3 cursor-pointer hover:opacity-75 transition-opacity"
							onClick={() => rootStore.settings.browseForWorktreePath()}
						/>
					</div>
					<ErrorBanner show={showError} error={error} />
					<ProgressSection show={showProgress} copyProgress={copyProgress} t={t} />
				</div>
				<DialogFooter>
					<Button variant="secondary" onClick={onClose} disabled={isCreating}>
						{t("worktrees:cancel")}
					</Button>
					<Button variant="primary" onClick={handleCreate} disabled={!isValid || isCreating}>
						{isCreating ? (
							<>
								<span className="codicon codicon-loading codicon-modifier-spin mr-2" />
								{t("worktrees:creating")}
							</>
						) : (
							t("worktrees:create")
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
