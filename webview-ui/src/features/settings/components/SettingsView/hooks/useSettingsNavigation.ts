import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
	Bell,
	CheckCheck,
	Database,
	FlaskConical,
	GitBranch,
	GitCommitVertical,
	Glasses,
	Globe,
	GraduationCap,
	Info,
	MessageSquare,
	Plug,
	Server,
	SquareSlash,
	SquareTerminal,
	Users2,
} from "lucide-react"
import { SectionName, sectionNames, settingsTabsContainer } from "../constants"

export function useSettingsNavigation(targetSection?: string) {
	const [activeTab, setActiveTab] = useState<SectionName>(
		targetSection && (sectionNames as readonly string[]).includes(targetSection)
			? (targetSection as SectionName)
			: "providers",
	)

	const scrollPositions = useRef<Record<SectionName, number>>(
		Object.fromEntries(sectionNames.map((s) => [s, 0])) as Record<SectionName, number>,
	)

	const contentRef = useRef<HTMLDivElement | null>(null)
	const tabRefs = useRef<Record<SectionName, HTMLButtonElement | null>>(
		Object.fromEntries(sectionNames.map((name) => [name, null])) as Record<SectionName, HTMLButtonElement | null>,
	)

	const [isCompactMode, setIsCompactMode] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!containerRef.current) return
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) setIsCompactMode(entry.contentRect.width < 500)
		})
		observer.observe(containerRef.current)
		return () => observer?.disconnect()
	}, [])

	const sections: { id: SectionName; icon: LucideIcon }[] = useMemo(
		() => [
			{ id: "providers", icon: Plug },
			{ id: "modes", icon: Users2 },
			{ id: "skills", icon: GraduationCap },
			{ id: "slashCommands", icon: SquareSlash },
			{ id: "autoApprove", icon: CheckCheck },
			{ id: "mcp", icon: Server },
			{ id: "checkpoints", icon: GitCommitVertical },
			{ id: "notifications", icon: Bell },
			{ id: "contextManagement", icon: Database },
			{ id: "terminal", icon: SquareTerminal },
			{ id: "prompts", icon: MessageSquare },
			{ id: "worktrees", icon: GitBranch },
			{ id: "ui", icon: Glasses },
			{ id: "experimental", icon: FlaskConical },
			{ id: "language", icon: Globe },
			{ id: "about", icon: Info },
		],
		[],
	)

	useEffect(() => {
		if (targetSection && (sectionNames as readonly string[]).includes(targetSection)) {
			setActiveTab(targetSection as SectionName)
		}
	}, [targetSection])

	const scrollToActiveTab = useCallback(() => {
		const el = tabRefs.current[activeTab]
		if (el) el.scrollIntoView({ behavior: "auto", block: "nearest" })
	}, [activeTab])

	useEffect(() => {
		scrollToActiveTab()
	}, [activeTab, scrollToActiveTab])

	useLayoutEffect(() => {
		const handler = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "action" && message.action === "didBecomeVisible") scrollToActiveTab()
		}
		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [scrollToActiveTab])

	const handleTabChange = useCallback(
		(newTab: SectionName) => {
			if (contentRef.current) scrollPositions.current[activeTab] = contentRef.current.scrollTop
			setActiveTab(newTab)
		},
		[activeTab],
	)

	useLayoutEffect(() => {
		if (contentRef.current) contentRef.current.scrollTop = scrollPositions.current[activeTab] ?? 0
	}, [activeTab])

	const containerClass = useMemo(() => {
		return isCompactMode ? `${settingsTabsContainer} narrow` : settingsTabsContainer
	}, [isCompactMode])

	return {
		activeTab,
		setActiveTab,
		contentRef,
		tabRefs,
		isCompactMode,
		containerRef,
		sections,
		handleTabChange,
		containerClass,
	}
}
