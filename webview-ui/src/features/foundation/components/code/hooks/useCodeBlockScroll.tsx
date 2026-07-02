import { useEffect, useRef, useState } from "react"
import { SCROLL_SNAP_TOLERANCE } from "../CodeBlock.constants"

export const useCodeBlockScroll = (
	preRef: React.RefObject<HTMLDivElement | null>,
	source: string | undefined,
): {
	wasScrolledUpRef: React.MutableRefObject<boolean>
	shouldScrollAfterHighlightRef: React.MutableRefObject<boolean>
	isSelecting: boolean
} => {
	const [isSelecting, setIsSelecting] = useState(false)
	const wasScrolledUpRef = useRef(false)

	useEffect(() => {
		const p = preRef.current
		if (!p) return
		const h = () => {
			wasScrolledUpRef.current = Math.abs(p.scrollHeight - p.scrollTop - p.clientHeight) >= SCROLL_SNAP_TOLERANCE
		}
		p.addEventListener("scroll", h, { passive: true })
		h()
		return () => p.removeEventListener("scroll", h)
	}, [preRef])

	const shouldScrollAfterHighlightRef = useRef(false)
	useEffect(() => {
		shouldScrollAfterHighlightRef.current = !!(preRef.current && source && !wasScrolledUpRef.current)
	}, [source, preRef, wasScrolledUpRef])

	useEffect(() => {
		const pe = preRef.current
		if (!pe) return
		let v = 0,
			af: number | null = null
		const F = 0.85,
			MV = 0.5,
			animate = () => {
				const sc = document.querySelector('[data-virtuoso-scroller="true"]') as HTMLElement
				if (!sc) return
				if (Math.abs(v) > MV) {
					sc.scrollBy(0, v)
					v *= F
					af = requestAnimationFrame(animate)
				} else {
					v = 0
					af = null
				}
			},
			hw = (e: WheelEvent) => {
				if (e.shiftKey || !pe) return
				if (pe.scrollHeight <= pe.clientHeight) return
				const sc = document.querySelector('[data-virtuoso-scroller="true"]') as HTMLElement
				if (!sc) return
				const at = pe.scrollTop === 0,
					ab = Math.abs(pe.scrollHeight - pe.scrollTop - pe.clientHeight) < 1
				if ((e.deltaY < 0 && at) || (e.deltaY > 0 && ab)) {
					e.preventDefault()
					v += e.deltaY * 0.15
					if (!af) af = requestAnimationFrame(animate)
				}
			}
		pe.addEventListener("wheel", hw, { passive: false })
		return () => {
			pe?.removeEventListener("wheel", hw)
			if (af) cancelAnimationFrame(af)
		}
	}, [preRef])

	useEffect(() => {
		const p = preRef.current
		if (!p) return
		const md = (e: MouseEvent) => {
			if (e.currentTarget === p) setIsSelecting(true)
		}
		p.addEventListener("mousedown", md)
		document.addEventListener("mouseup", () => setIsSelecting(false))
		return () => {
			p.removeEventListener("mousedown", md)
			document.removeEventListener("mouseup", () => setIsSelecting(false))
		}
	}, [preRef])

	return { wasScrolledUpRef, shouldScrollAfterHighlightRef, isSelecting }
}
