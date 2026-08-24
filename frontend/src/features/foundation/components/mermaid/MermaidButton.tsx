import { useState, useCallback } from "react"
import { useCopyToClipboard } from "@sections/dndTextArea/utils/clipboard/clipboard"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { rootStore } from "@src/features/store"
import { MermaidActionButtons } from "./MermaidActionButtons"
import { MermaidModal } from "./MermaidModal"

const MIN_ZOOM = 0.5
const MAX_ZOOM = 20

export interface MermaidButtonProps {
	containerRef: React.RefObject<HTMLDivElement>
	code: string
	isLoading: boolean
	svgToPng: (svgEl: SVGElement) => Promise<string>
	children: React.ReactNode
}

export function MermaidButton({ containerRef, code, isLoading, svgToPng, children }: MermaidButtonProps) {
	const [showModal, setShowModal] = useState(false)
	const [zoomLevel, setZoomLevel] = useState(1)
	const [copyFeedback, setCopyFeedback] = useState(false)
	const [isHovering, setIsHovering] = useState(false)
	const [modalViewMode, setModalViewMode] = useState<"diagram" | "code">("diagram")
	const [isDragging, setIsDragging] = useState(false)
	const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 })
	const { copyWithFeedback } = useCopyToClipboard()
	const { t } = useAppTranslation()

	const handleZoom = async (e: React.MouseEvent) => {
		e.stopPropagation()
		setShowModal(true)
		setZoomLevel(1)
		setModalViewMode("diagram")
	}

	const handleCopy = async (e: React.MouseEvent) => {
		e.stopPropagation()
		try {
			await copyWithFeedback(code, e)
			setCopyFeedback(true)
			setTimeout(() => setCopyFeedback(false), 2000)
		} catch (err) {
			console.error("[jabberwock] Error copying text:", err instanceof Error ? err.message : String(err))
		}
	}

	const handleSave = async (e: React.MouseEvent) => {
		e.stopPropagation()
		const svgEl = containerRef.current?.querySelector("svg")
		if (!svgEl) {
			console.error("[jabberwock] SVG element not found")
			return
		}
		try {
			const pngDataUrl = await svgToPng(svgEl)
			rootStore.cloud.saveImage(pngDataUrl)
		} catch (error) {
			console.error("[jabberwock] Error saving image:", error)
		}
	}

	const adjustZoom = (amount: number) => setZoomLevel((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + amount)))

	const handleWheel = useCallback((e: React.WheelEvent) => {
		e.preventDefault()
		e.stopPropagation()
		adjustZoom(e.deltaY > 0 ? -0.2 : 0.2)
	}, [])

	const handleMouseEnter = () => setIsHovering(true)
	const handleMouseLeave = () => setIsHovering(false)

	return (
		<>
			<div className="relative w-full" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
				{children}
				{!isLoading && isHovering && (
					<div className="absolute bottom-2 right-2 flex gap-1 bg-vscode-editor-background/90 rounded p-0.5 z-10 opacity-100 transition-opacity duration-200 ease-in-out">
						<MermaidActionButtons
							onZoom={handleZoom}
							onCopy={handleCopy}
							onSave={handleSave}
							onViewCode={() => {
								setShowModal(true)
								setModalViewMode("code")
								setZoomLevel(1)
							}}
							copyFeedback={copyFeedback}
						/>
					</div>
				)}
			</div>
			<MermaidModal
				code={code}
				containerRef={containerRef}
				copyFeedback={copyFeedback}
				isDragging={isDragging}
				zoomLevel={zoomLevel}
				dragPosition={dragPosition}
				modalViewMode={modalViewMode}
				showModal={showModal}
				handleWheel={handleWheel}
				handleCopy={handleCopy}
				handleSave={handleSave}
				copyWithFeedback={copyWithFeedback}
				setShowModal={setShowModal}
				setModalViewMode={setModalViewMode}
				setIsDragging={setIsDragging}
				setDragPosition={setDragPosition}
				adjustZoom={adjustZoom}
				t={t}
			/>
		</>
	)
}
