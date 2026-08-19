import { useEffect, useRef, useState, useCallback } from "react"
import { WINDOW_SHADE_SETTINGS } from "./CodeBlock.constants"
import { getCSSPadding, getWrapperHeight } from "./CodeBlock.components"
import { useCodeHighlight } from "./hooks/useCodeHighlight"
import { useCodeBlockScroll } from "./hooks/useCodeBlockScroll"

interface UseCodeBlockReturn {
	codeBlockRef: React.RefObject<HTMLDivElement | null>
	preRef: React.RefObject<HTMLDivElement | null>
	copyButtonWrapperRef: React.RefObject<HTMLDivElement | null>
	highlightedCode: React.ReactNode
	windowShade: boolean
	showCollapseButton: boolean
	isSelecting: boolean
	handleCopy: (e: React.MouseEvent) => void
	handleToggleWindowShade: () => void
	updateCodeBlockButtonPosition: (forceHide?: boolean) => void
}

export const useCodeBlock = (
	source: string | undefined,
	rawSource: string | undefined,
	currentLanguage: string,
	copyWithFeedback: (text: string, event: React.MouseEvent) => void,
): UseCodeBlockReturn => {
	const [windowShade, setWindowShade] = useState(true),
		[showCollapseButton, setShowCollapseButton] = useState(true)

	const codeBlockRef = useRef<HTMLDivElement | null>(null),
		preRef = useRef<HTMLDivElement | null>(null),
		copyButtonWrapperRef = useRef<HTMLDivElement | null>(null)

	const { highlightedCode, collapseTimeout1Ref, collapseTimeout2Ref } = useCodeHighlight(source, currentLanguage)

	const { wasScrolledUpRef, shouldScrollAfterHighlightRef, isSelecting } = useCodeBlockScroll(preRef, source)

	useEffect(() => {
		const cb = codeBlockRef.current
		if (cb) setShowCollapseButton(cb.scrollHeight >= WINDOW_SHADE_SETTINGS.collapsedHeight)
	}, [highlightedCode])

	const buttonPositionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

	const updateCodeBlockButtonPosition = useCallback((forceHide = false) => {
		const cb = codeBlockRef.current,
			sc = document.querySelector('[data-virtuoso-scroller="true"]')
		if (!cb || !sc) return
		const rc = cb.getBoundingClientRect(),
			sr = sc.getBoundingClientRect(),
			ce = 48,
			pv = rc.top < sr.bottom - ce && rc.bottom >= sr.top + ce,
			m = getCSSPadding(window.getComputedStyle(cb))
		const pvTop = Math.max(
			sr.top + m,
			Math.min(rc.bottom - getWrapperHeight(copyButtonWrapperRef.current) - m, rc.top + m),
		)
		cb.style.setProperty("--copy-button-top", `${pvTop}px`)
		cb.style.setProperty("--copy-button-right", `${Math.max(m, sr.right - rc.right + m)}px`)
		cb.setAttribute("data-partially-visible", pv ? "true" : "false")
		const v = !forceHide && pv
		cb.style.setProperty("--copy-button-cursor", v ? "pointer" : "default")
		cb.style.setProperty("--copy-button-events", v ? "all" : "none")
		cb.style.setProperty("--copy-button-opacity", v ? "1" : "0")
	}, [])

	useEffect(() => {
		const h = () => updateCodeBlockButtonPosition(),
			sc = document.querySelector('[data-virtuoso-scroller="true"]')
		if (sc) {
			sc.addEventListener("scroll", h)
			window.addEventListener("resize", h)
			updateCodeBlockButtonPosition()
		}
		return () => {
			if (sc) {
				sc.removeEventListener("scroll", h)
				window.removeEventListener("resize", h)
			}
		}
	}, [updateCodeBlockButtonPosition])

	useEffect(() => {
		if (highlightedCode) {
			if (buttonPositionTimeoutRef.current) clearTimeout(buttonPositionTimeoutRef.current)
			buttonPositionTimeoutRef.current = setTimeout(() => {
				updateCodeBlockButtonPosition()
				buttonPositionTimeoutRef.current = null
			}, 0)
			if (shouldScrollAfterHighlightRef.current) {
				if (preRef.current) {
					preRef.current.scrollTop = preRef.current.scrollHeight
					wasScrolledUpRef.current = false
				}
				shouldScrollAfterHighlightRef.current = false
			}
		}
		return () => {
			if (buttonPositionTimeoutRef.current) clearTimeout(buttonPositionTimeoutRef.current)
		}
	}, [highlightedCode, updateCodeBlockButtonPosition, shouldScrollAfterHighlightRef, wasScrolledUpRef])

	const handleCopy = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			const cb = codeBlockRef.current
			if (!cb || cb.getAttribute("data-partially-visible") !== "true") return
			const t = rawSource !== undefined ? rawSource : source || ""
			if (t) copyWithFeedback(t, e)
		},
		[source, rawSource, copyWithFeedback],
	)

	const handleToggleWindowShade = useCallback(() => {
		const cb = codeBlockRef.current
		setWindowShade((prev) => !prev)
		if (collapseTimeout1Ref.current) clearTimeout(collapseTimeout1Ref.current)
		if (collapseTimeout2Ref.current) clearTimeout(collapseTimeout2Ref.current)
		collapseTimeout1Ref.current = setTimeout(
			() => {
				if (cb) {
					cb.scrollIntoView({ behavior: "smooth", block: "nearest" })
					collapseTimeout2Ref.current = setTimeout(() => {
						updateCodeBlockButtonPosition()
						collapseTimeout2Ref.current = null
					}, 50)
				}
				collapseTimeout1Ref.current = null
			},
			WINDOW_SHADE_SETTINGS.transitionDelayS * 1000 + 50,
		)
	}, [updateCodeBlockButtonPosition, collapseTimeout1Ref, collapseTimeout2Ref])

	return {
		codeBlockRef,
		preRef,
		copyButtonWrapperRef,
		highlightedCode,
		windowShade,
		showCollapseButton,
		isSelecting,
		handleCopy,
		handleToggleWindowShade,
		updateCodeBlockButtonPosition,
	}
}
