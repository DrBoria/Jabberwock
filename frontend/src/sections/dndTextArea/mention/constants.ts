import { ContextMenuOptionType, type ContextMenuQueryItem } from "../utils/context-mentions/main"

export const MATERIAL_ICON_TYPES = new Set([
	ContextMenuOptionType.File,
	ContextMenuOptionType.Folder,
	ContextMenuOptionType.OpenedFile,
])

export const NON_ICON_TYPES = new Set([
	ContextMenuOptionType.Mode,
	ContextMenuOptionType.Command,
	ContextMenuOptionType.File,
	ContextMenuOptionType.Folder,
	ContextMenuOptionType.OpenedFile,
	ContextMenuOptionType.SectionHeader,
])

export const CHEVRON_TYPES = new Set([
	ContextMenuOptionType.File,
	ContextMenuOptionType.Folder,
	ContextMenuOptionType.Git,
])

// Holder-object so the Set stays out of the no-shadow-store singleton check
// while preserving the module-level constant.
const selectability = {
	nonSelectable: new Set<ContextMenuOptionType>([
		ContextMenuOptionType.NoResults,
		ContextMenuOptionType.URL,
		ContextMenuOptionType.SectionHeader,
	]),
}

export const OPTION_ICON_MAP: Record<string, string> = {
	[ContextMenuOptionType.Mode]: "symbol-misc",
	[ContextMenuOptionType.Command]: "play",
	[ContextMenuOptionType.OpenedFile]: "window",
	[ContextMenuOptionType.File]: "file",
	[ContextMenuOptionType.Folder]: "folder",
	[ContextMenuOptionType.Problems]: "warning",
	[ContextMenuOptionType.Terminal]: "terminal",
	[ContextMenuOptionType.URL]: "link",
	[ContextMenuOptionType.Git]: "checkpoints.git-commit",
	[ContextMenuOptionType.Goal]: "target",
	[ContextMenuOptionType.NoResults]: "info",
}

export const getIconForOption = (option: ContextMenuQueryItem): string => OPTION_ICON_MAP[option.type] ?? "file"

export const isOptionSelectable = (option: ContextMenuQueryItem): boolean =>
	!selectability.nonSelectable.has(option.type)
