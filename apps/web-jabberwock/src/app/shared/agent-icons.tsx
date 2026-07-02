import {
	GitPullRequest,
	Wrench,
	Key,
	MessageSquareCode,
	Blocks,
	ListChecks,
	BookMarked,
	History,
	type LucideIcon,
} from "lucide-react"

import type { IconName } from "./agent-page-content"

const iconMap: Record<IconName, LucideIcon> = {
	GitPullRequest,
	Wrench,
	Key,
	MessageSquareCode,
	Blocks,
	ListChecks,
	BookMarked,
	History,
}

export function getIcon(iconName?: IconName): LucideIcon | undefined {
	return iconName ? iconMap[iconName] : undefined
}
