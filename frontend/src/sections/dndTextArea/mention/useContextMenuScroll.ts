import { useEffect, type RefObject } from "react"

export const useContextMenuScroll = (menuRef: RefObject<HTMLDivElement | null>, selectedIndex: number): void => {
	useEffect(() => {
		if (!menuRef.current) return
		const el = menuRef.current.children[selectedIndex] as HTMLElement
		if (!el) return
		const menuRect = menuRef.current.getBoundingClientRect()
		const selRect = el.getBoundingClientRect()
		if (selRect.bottom > menuRect.bottom) menuRef.current.scrollTop += selRect.bottom - menuRect.bottom
		else if (selRect.top < menuRect.top) menuRef.current.scrollTop -= menuRect.top - selRect.top
	}, [selectedIndex, menuRef])
}
