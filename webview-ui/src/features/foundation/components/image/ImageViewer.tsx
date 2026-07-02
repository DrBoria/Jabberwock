import { useState, useCallback } from "react"
import { useCopyToClipboard } from "@sections/dndTextArea/utils/clipboard/clipboard"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { rootStore } from "@src/features/store"
import { ImageViewerPreview } from "./ImageViewerPreview"
import { ImageZoomModal } from "./ImageZoomModal"

const MIN_ZOOM = 0.5
const MAX_ZOOM = 20

export interface ImageViewerProps {
	imageUri: string
	imagePath?: string
	alt?: string
	showControls?: boolean
	className?: string
}

export function ImageViewer({
	imageUri,
	imagePath,
	alt = "Generated image",
	showControls = true,
	className = "",
}: ImageViewerProps) {
	const [showModal, setShowModal] = useState(false)
	const [zoomLevel, setZoomLevel] = useState(1)
	const [copyFeedback, setCopyFeedback] = useState(false)
	const [isHovering, setIsHovering] = useState(false)
	const [isDragging, setIsDragging] = useState(false)
	const [, setDragPosition] = useState({ x: 0, y: 0 })
	const [imageError, setImageError] = useState<string | null>(null)
	const { copyWithFeedback } = useCopyToClipboard()
	const { t } = useAppTranslation()

	const handleZoom = async (e: React.MouseEvent): Promise<void> => {
		e.stopPropagation()
		setShowModal(true)
		setZoomLevel(1)
		setDragPosition({ x: 0, y: 0 })
	}

	const handleCopy = async (e: React.MouseEvent): Promise<void> => {
		e.stopPropagation()
		try {
			if (imagePath) {
				await copyWithFeedback(imagePath, e)
				setCopyFeedback(true)
				setTimeout(() => setCopyFeedback(false), 2000)
			}
		} catch (err) {
			console.error("[jabberwock] Error copying:", err instanceof Error ? err.message : String(err))
		}
	}

	const handleSave = async (e: React.MouseEvent): Promise<void> => {
		e.stopPropagation()
		try {
			rootStore.cloud.saveImage(imageUri)
		} catch (error) {
			console.error("[jabberwock] Error saving image:", error)
		}
	}

	const handleOpenInEditor = (e: React.MouseEvent): void => {
		e.stopPropagation()
		if (imagePath) rootStore.settings.openImage(imagePath)
		else if (imageUri) rootStore.settings.openImage(imageUri)
	}

	const adjustZoom = (amount: number): void => {
		setZoomLevel((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + amount)))
	}

	const handleWheel = useCallback((e: React.WheelEvent): void => {
		e.preventDefault()
		e.stopPropagation()
		adjustZoom(e.deltaY > 0 ? -0.2 : 0.2)
	}, [])

	const handleMouseEnter = (): void => {
		setIsHovering(true)
	}
	const handleMouseLeave = (): void => {
		setIsHovering(false)
	}
	const handleImageError = useCallback((): void => {
		setImageError("Failed to load image")
	}, [])
	const handleImageLoad = useCallback((): void => {
		setImageError(null)
	}, [])

	const handleModalMouseDown = (e: React.MouseEvent): void => {
		setIsDragging(true)
		e.preventDefault()
	}

	const handleModalMouseMove = (e: React.MouseEvent): void => {
		if (isDragging)
			setDragPosition((prev) => ({ x: prev.x + e.movementX / zoomLevel, y: prev.y + e.movementY / zoomLevel }))
	}

	const handleModalMouseUp = (): void => setIsDragging(false)
	const handleModalMouseLeave = (): void => setIsDragging(false)

	if (!imageUri)
		return (
			<div
				className={`relative w-full ${className}`}
				style={{
					minHeight: "100px",
					backgroundColor: "var(--vscode-editor-background)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}>
				<span style={{ color: "var(--vscode-descriptionForeground)" }}>{t("common:image.noData")}</span>
			</div>
		)

	return (
		<>
			<ImageViewerPreview
				imageUri={imageUri}
				alt={alt}
				className={className}
				showControls={showControls}
				isHovering={isHovering}
				copyFeedback={copyFeedback}
				imageError={imageError}
				imagePath={imagePath}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				onOpenInEditor={handleOpenInEditor}
				onImageError={handleImageError}
				onImageLoad={handleImageLoad}
				onZoom={handleZoom}
				onCopy={handleCopy}
				onSave={handleSave}
			/>
			<ImageZoomModal
				showModal={showModal}
				imageUri={imageUri}
				alt={alt}
				zoomLevel={zoomLevel}
				isDragging={isDragging}
				copyFeedback={copyFeedback}
				imagePath={imagePath}
				onClose={() => setShowModal(false)}
				onWheel={handleWheel}
				onMouseDown={handleModalMouseDown}
				onMouseMove={handleModalMouseMove}
				onMouseUp={handleModalMouseUp}
				onMouseLeave={handleModalMouseLeave}
				onCopy={handleCopy}
				onSave={handleSave}
				adjustZoom={adjustZoom}
				t={t}
			/>
		</>
	)
}
