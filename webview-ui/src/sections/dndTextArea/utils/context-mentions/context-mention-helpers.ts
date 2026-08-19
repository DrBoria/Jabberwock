import { Fzf } from "fzf"
import type { ModeConfig, Command } from "@jabberwock/types"
import { ContextMenuOptionType, type ContextMenuQueryItem, type SearchResult } from "./context-mention-types"

function getBasename(filepath: string): string {
	return filepath.split("/").pop() || filepath
}

function getModeDescription(mode: ModeConfig): string {
	return (mode.description || mode.whenToUse || mode.roleDefinition).split("\n")[0]
}

export function getSlashCommandOptions(
	slashQuery: string,
	commands: Command[] | undefined,
	modes: ModeConfig[] | undefined,
): ContextMenuQueryItem[] {
	const results: ContextMenuQueryItem[] = []

	if (commands?.length) {
		const searchableCommands = commands.map((command) => ({
			original: command,
			searchStr: command.name,
		}))
		const fzf = new Fzf(searchableCommands, {
			selector: (item) => item.searchStr,
		})
		const matchingCommands = slashQuery
			? fzf.find(slashQuery).map((result) => ({
					type: ContextMenuOptionType.Command,
					value: result.item.original.name,
					slashCommand: `/${result.item.original.name}`,
					description: result.item.original.description,
					argumentHint: result.item.original.argumentHint,
				}))
			: commands.map((command) => ({
					type: ContextMenuOptionType.Command,
					value: command.name,
					slashCommand: `/${command.name}`,
					description: command.description,
					argumentHint: command.argumentHint,
				}))

		if (matchingCommands.length > 0) {
			results.push({
				type: ContextMenuOptionType.SectionHeader,
				label: "Commands",
			})
			results.push(...matchingCommands)
		}
	}

	if (modes?.length) {
		const searchableItems = modes.map((mode) => ({
			original: mode,
			searchStr: mode.name,
		}))
		const fzf = new Fzf(searchableItems, {
			selector: (item) => item.searchStr,
		})
		const matchingModes = slashQuery
			? fzf.find(slashQuery).map((result) => ({
					type: ContextMenuOptionType.Mode,
					value: result.item.original.slug,
					slashCommand: `/${result.item.original.slug}`,
					description: getModeDescription(result.item.original),
				}))
			: modes.map((mode) => ({
					type: ContextMenuOptionType.Mode,
					value: mode.slug,
					slashCommand: `/${mode.slug}`,
					description: getModeDescription(mode),
				}))

		if (matchingModes.length > 0) {
			results.push({
				type: ContextMenuOptionType.SectionHeader,
				label: "Modes",
			})
			results.push(...matchingModes)
		}
	}

	return results.length > 0 ? results : [{ type: ContextMenuOptionType.NoResults }]
}
export function getEmptyQueryOptions(
	selectedType: ContextMenuOptionType,
	queryItems: ContextMenuQueryItem[],
	workingChanges: ContextMenuQueryItem,
): ContextMenuQueryItem[] {
	if (selectedType === ContextMenuOptionType.File) {
		const files = queryItems
			.filter(
				(item) => item.type === ContextMenuOptionType.File || item.type === ContextMenuOptionType.OpenedFile,
			)
			.map((item) => ({
				type: item.type,
				value: item.value,
			}))
		return files.length > 0 ? files : [{ type: ContextMenuOptionType.NoResults }]
	}

	if (selectedType === ContextMenuOptionType.Folder) {
		const folders = queryItems
			.filter((item) => item.type === ContextMenuOptionType.Folder)
			.map((item) => ({ type: ContextMenuOptionType.Folder, value: item.value }))
		return folders.length > 0 ? folders : [{ type: ContextMenuOptionType.NoResults }]
	}

	if (selectedType === ContextMenuOptionType.Git) {
		const commits = queryItems.filter((item) => item.type === ContextMenuOptionType.Git)
		return commits.length > 0 ? [workingChanges, ...commits] : [workingChanges]
	}

	return [
		{ type: ContextMenuOptionType.Problems },
		{ type: ContextMenuOptionType.Terminal },
		{ type: ContextMenuOptionType.URL },
		{ type: ContextMenuOptionType.Folder },
		{ type: ContextMenuOptionType.File },
		{ type: ContextMenuOptionType.Git },
	]
}

export function getFilteredAndDedupedOptions(
	query: string,
	queryItems: ContextMenuQueryItem[],
	dynamicSearchResults: SearchResult[],
): ContextMenuQueryItem[] {
	const lowerQuery = query.toLowerCase()
	const suggestions: ContextMenuQueryItem[] = []

	const workingChangesItem: ContextMenuQueryItem = {
		type: ContextMenuOptionType.Git,
		value: "git-changes",
		label: "Working changes",
		description: "Current uncommitted changes",
		icon: "$(git-commit)",
	}

	if ("git".startsWith(lowerQuery)) {
		suggestions.push({
			type: ContextMenuOptionType.Git,
			label: "Git Commits",
			description: "Search repository history",
			icon: "$(git-commit)",
		})
	} else if ("git-changes".startsWith(lowerQuery)) {
		suggestions.push(workingChangesItem)
	}
	if ("problems".startsWith(lowerQuery)) {
		suggestions.push({ type: ContextMenuOptionType.Problems })
	}
	if ("terminal".startsWith(lowerQuery)) {
		suggestions.push({ type: ContextMenuOptionType.Terminal })
	}
	if (query.startsWith("http")) {
		suggestions.push({ type: ContextMenuOptionType.URL, value: query })
	}

	if (/^[a-f0-9]{7,40}$/i.test(lowerQuery)) {
		const exactMatches = queryItems.filter(
			(item) => item.type === ContextMenuOptionType.Git && item.value?.toLowerCase() === lowerQuery,
		)
		if (exactMatches.length > 0) {
			suggestions.push(...exactMatches)
		} else {
			suggestions.push({
				type: ContextMenuOptionType.Git,
				value: lowerQuery,
				label: `Commit ${lowerQuery}`,
				description: "Git commit hash",
				icon: "$(git-commit)",
			})
		}
	}

	const searchableItems = queryItems.map((item) => ({
		original: item,
		searchStr: [item.value, item.label, item.description].filter(Boolean).join(" "),
	}))

	const fzf = new Fzf(searchableItems, {
		selector: (item) => item.searchStr,
	})

	const matchingItems = query ? fzf.find(query).map((result) => result.item.original) : []

	const openedFileMatches = matchingItems.filter((item) => item.type === ContextMenuOptionType.OpenedFile)
	const gitMatches = matchingItems.filter((item) => item.type === ContextMenuOptionType.Git)

	const searchResultItems = dynamicSearchResults.map((result) => {
		const formattedPath = result.path.startsWith("/") ? result.path : `/${result.path}`
		const displayName = result.label || getBasename(result.path)
		return {
			type: result.type === "folder" ? ContextMenuOptionType.Folder : ContextMenuOptionType.File,
			value: formattedPath,
			label: displayName,
			description: formattedPath,
		}
	})

	const allItems = [...suggestions, ...openedFileMatches, ...searchResultItems, ...gitMatches]

	const seen = new Set<string>()
	const deduped = allItems.filter((item) => {
		let key = ""
		if (
			item.type === ContextMenuOptionType.File ||
			item.type === ContextMenuOptionType.Folder ||
			item.type === ContextMenuOptionType.OpenedFile
		) {
			key = item.value!
		} else {
			key = `${item.type}-${item.value}`
		}
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})

	return deduped.length > 0 ? deduped : [{ type: ContextMenuOptionType.NoResults }]
}
