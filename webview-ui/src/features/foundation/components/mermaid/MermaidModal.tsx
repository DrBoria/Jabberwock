import React from "react"
import { Modal } from "../ui/layout/Modal"
import { TabButton } from "../ui/button/TabButton"
import { IconButton } from "../ui/button/IconButton"
import { ZoomControls } from "../image/ZoomControls"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"

interface MermaidModalProps {
	code: string
	containerRef: React.RefObject<HTMLDivElement>
	copyFeedback: boolean
	isDragging: boolean
	zoomLevel: number
	dragPosition: { x: number; y: number }
	modalViewMode: "diagram" | "code"
	showModal: boolean
	handleWheel: (e: React.WheelEvent) => void
	handleCopy: (e: React.MouseEvent) => Promise<void>
	handleSave: (e: React.MouseEvent) => Promise<void>
	copyWithFeedback: (text: string, e: React.MouseEvent) => Promise<boolean>
	setShowModal: (v: boolean) => void
	setModalViewMode: (v: "diagram" | "code") => void
	setIsDragging: (v: boolean) => void
	setDragPosition: (
		v: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number }),
	) => void
	adjustZoom: (amount: number) => void
	t: (key: string) => string
}

export function MermaidModal({
	code,
	containerRef,
	copyFeedback,
	isDragging,
	zoomLevel,
	dragPosition,
	modalViewMode,
	showModal,
	handleWheel,
	handleCopy,
	handleSave,
	copyWithFeedback,
	setShowModal,
	setModalViewMode,
	setIsDragging,
	setDragPosition,
	adjustZoom,
	t,
}: MermaidModalProps) {
	return (
		<Modal isOpen={showModal} onClose={() => setShowModal(false)}>
			<div className="flex justify-between items-center border-b border-vscode-editorGroup-border">
				<div className="flex gap-0">
					<TabButton
						icon="graph"
						label={t("common:mermaid.tabs.diagram")}
						isActive={modalViewMode === "diagram"}
						onClick={() => setModalViewMode("diagram")}
					/>
					<TabButton
						icon="code"
						label={t("common:mermaid.tabs.code")}
						isActive={modalViewMode === "code"}
						onClick={() => setModalViewMode("code")}
					/>
				</div>
				<div className="pr-3">
					<StandardTooltip content={t("common:mermaid.buttons.close")}>
						<IconButton icon="close" onClick={() => setShowModal(false)} />
					</StandardTooltip>
				</div>
			</div>
			<div
				className="flex-1 p-4 pb-[60px] overflow-auto flex items-center justify-center"
				onWheel={modalViewMode === "diagram" ? handleWheel : undefined}>
				{modalViewMode === "diagram" ? (
					<>
						<div
							style={{
								transform: `scale(${zoomLevel}) translate(${dragPosition.x}px, ${dragPosition.y}px)`,
								transformOrigin: "center center",
								transition: isDragging ? "none" : "transform 0.1s ease",
								cursor: isDragging ? "grabbing" : "grab",
							}}
							onMouseDown={(e) => {
								setIsDragging(true)
								e.preventDefault()
							}}
							onMouseMove={(e) => {
								if (isDragging)
									setDragPosition((prev) => ({
										x: prev.x + e.movementX / zoomLevel,
										y: prev.y + e.movementY / zoomLevel,
									}))
							}}
							onMouseUp={() => setIsDragging(false)}
							onMouseLeave={() => setIsDragging(false)}>
							{containerRef.current && containerRef.current.innerHTML && (
								<div dangerouslySetInnerHTML={{ __html: containerRef.current.innerHTML }} />
							)}
						</div>
						<div className="absolute bottom-4 left-4 bg-vscode-editor-background border border-vscode-editorGroup-border rounded px-2 py-1 text-xs text-vscode-descriptionForeground pointer-events-none opacity-80">
							{Math.round(zoomLevel * 100)}%
						</div>
					</>
				) : (
					<textarea
						className="w-full min-h-[200px] bg-vscode-editor-background text-vscode-editor-foreground border border-vscode-editorGroup-border rounded-[3px] p-2 font-mono resize-y outline-none"
						readOnly
						value={code}
						style={{ height: "100%", minHeight: "unset", fontSize: "var(--vscode-editor-font-size)" }}
					/>
				)}
			</div>
			<div className="absolute bottom-0 right-0 left-0 p-3 flex items-center justify-end gap-2 bg-vscode-editor-background border-t border-vscode-editorGroup-border rounded-b">
				{modalViewMode === "diagram" ? (
					<>
						<ZoomControls
							zoomLevel={zoomLevel}
							zoomInTitle={t("common:mermaid.buttons.zoomIn")}
							zoomOutTitle={t("common:mermaid.buttons.zoomOut")}
							useContinuousZoom={true}
							adjustZoom={adjustZoom}
							zoomInStep={0.2}
							zoomOutStep={-0.2}
						/>
						<StandardTooltip content={t("common:mermaid.buttons.copy")}>
							<IconButton icon={copyFeedback ? "check" : "copy"} onClick={handleCopy} />
						</StandardTooltip>
						<StandardTooltip content={t("common:mermaid.buttons.save")}>
							<IconButton icon="save" onClick={handleSave} />
						</StandardTooltip>
					</>
				) : (
					<StandardTooltip content={t("common:mermaid.buttons.copy")}>
						<IconButton
							icon={copyFeedback ? "check" : "copy"}
							onClick={(e) => {
								e.stopPropagation()
								copyWithFeedback(code, e)
							}}
						/>
					</StandardTooltip>
				)}
			</div>
		</Modal>
	)
}
