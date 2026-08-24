import type { Goal } from "@jabberwock/types"

export const MAX_ATTACHED_IMAGES = 20

const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0
export const ctrlOrCmd = isMac ? "⌘" : "Ctrl"

export const getVolume = (soundVolume: unknown): number => (typeof soundVolume === "number" ? soundVolume : 0.5)

export const getShouldDisableImages = (
	model: { supportsImages?: boolean } | undefined,
	selectedImageCount: number,
): boolean => !model?.supportsImages || selectedImageCount >= MAX_ATTACHED_IMAGES

export const getPlaceholderText = (currentTaskItem: unknown, t: (key: string) => string): string =>
	currentTaskItem ? t("chat:typeMessage") : t("chat:typeTask")

export const getGoals = (isStreaming: boolean, currentTaskItem: { goals?: Goal[] } | undefined): Goal[] =>
	isStreaming ? [] : (currentTaskItem?.goals ?? [])
