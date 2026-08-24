import type { SayToolData } from "@jabberwock/types"

export const getBatchLabels = (
	kind: string,
	t: (key: string, options?: Record<string, unknown>) => string,
): { primary: string; secondary: string } => {
	const map: Record<string, [string, string]> = {
		edit: ["chat:edit-batch.approve.title", "chat:edit-batch.deny.title"],
		read: ["chat:read-batch.approve.title", "chat:read-batch.deny.title"],
		list: ["chat:list-batch.approve.title", "chat:list-batch.deny.title"],
	}
	return map[kind]
		? { primary: t(map[kind][0]), secondary: t(map[kind][1]) }
		: { primary: t("chat:approve.title"), secondary: t("chat:reject.title") }
}

export function getToolButtonLabels(
	tool: SayToolData,
	t: (key: string, options?: Record<string, unknown>) => string,
): { primary: string; secondary: string } {
	const labels: Record<string, () => { primary: string; secondary: string }> = {
		editedExistingFile: () =>
			tool.batchDiffs && Array.isArray(tool.batchDiffs)
				? getBatchLabels("edit", t)
				: { primary: t("chat:save.title"), secondary: t("chat:reject.title") },
		appliedDiff: () =>
			tool.batchDiffs && Array.isArray(tool.batchDiffs)
				? getBatchLabels("edit", t)
				: { primary: t("chat:save.title"), secondary: t("chat:reject.title") },
		newFileCreated: () =>
			tool.batchDiffs && Array.isArray(tool.batchDiffs)
				? getBatchLabels("edit", t)
				: { primary: t("chat:save.title"), secondary: t("chat:reject.title") },
		generateImage: () => ({ primary: t("chat:save.title"), secondary: t("chat:reject.title") }),
		finishTask: () => ({ primary: t("chat:completeSubtaskAndReturn"), secondary: "" }),
		readFile: () =>
			tool.batchFiles && Array.isArray(tool.batchFiles)
				? getBatchLabels("read", t)
				: { primary: t("chat:approve.title"), secondary: t("chat:reject.title") },
		listFilesTopLevel: () =>
			tool.batchDirs && Array.isArray(tool.batchDirs)
				? getBatchLabels("list", t)
				: { primary: t("chat:approve.title"), secondary: t("chat:reject.title") },
		listFilesRecursive: () =>
			tool.batchDirs && Array.isArray(tool.batchDirs)
				? getBatchLabels("list", t)
				: { primary: t("chat:approve.title"), secondary: t("chat:reject.title") },
	}
	return labels[tool.tool]?.() ?? { primary: t("chat:approve.title"), secondary: t("chat:reject.title") }
}
