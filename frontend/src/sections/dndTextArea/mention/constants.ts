import { ContextMenuOptionType, type ContextMenuQueryItem } from "../utils/context-mentions/context-mentions"

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

export const NON_SELECTABLE_TYPES = new Set([
	ContextMenuOptionType.NoResults,
	ContextMenuOptionType.URL,
	ContextMenuOptionType.SectionHeader,
])

export const OPTION_ICON_MAP: Record<string, string> = {
	[ContextMenuOptionType.Mode]: "symbol-misc",
	[ContextMenuOptionType.Command]: "play",
	[ContextMenuOptionType.OpenedFile]: "window",
	[ContextMenuOptionType.File]: "file",
	[ContextMenuOptionType.Folder]: "folder",
	[ContextMenuOptionType.Problems]: "warning",
	[ContextMenuOptionType.Terminal]: "terminal",
	[ContextMenuOptionType.URL]: "link",
	[ContextMenuOptionType.Git]: "git-commit",
	[ContextMenuOptionType.Goal]: "target",
	[ContextMenuOptionType.NoResults]: "info",
}

export const getIconForOption = (option: ContextMenuQueryItem): string => OPTION_ICON_MAP[option.type] ?? "file"

export const isOptionSelectable = (option: ContextMenuQueryItem): boolean => !NON_SELECTABLE_TYPES.has(option.type)
