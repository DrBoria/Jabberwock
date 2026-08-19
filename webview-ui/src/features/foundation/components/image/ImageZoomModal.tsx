import { Modal } from "../ui/layout/Modal"
import { TabButton } from "../ui/button/TabButton"
import { IconButton } from "../ui/button/IconButton"
import { ZoomControls } from "./ZoomControls"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"

interface ImageZoomModalProps {
	showModal: boolean
	imageUri: string
	alt: string
	zoomLevel: number
	isDragging: boolean
	copyFeedback: boolean
	imagePath: string | undefined
	onClose: () => void
	onWheel: (e: React.WheelEvent) => void
	onMouseDown: (e: React.MouseEvent) => void
	onMouseMove: (e: React.MouseEvent) => void
	onMouseUp: () => void
	onMouseLeave: () => void
	onCopy: (e: React.MouseEvent) => void
	onSave: (e: React.MouseEvent) => void
	adjustZoom: (amount: number) => void
	t: (key: string) => string
}

export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({
	showModal,
	imageUri,
	alt,
	zoomLevel,
	isDragging,
	copyFeedback,
	imagePath,
	onClose,
	onWheel,
	onMouseDown,
	onMouseMove,
	onMouseUp,
	onMouseLeave,
	onCopy,
	onSave,
	adjustZoom,
	t,
}) => (
	<Modal isOpen={showModal} onClose={onClose}>
		<div className="flex justify-between items-center border-b border-vscode-editorGroup-border">
			<div className="flex gap-0">
				<TabButton icon="file-media" label={t("common:image.tabs.view")} isActive={true} onClick={() => {}} />
			</div>
			<div className="pr-3">
				<StandardTooltip content={t("common:mermaid.buttons.close")}>
					<IconButton icon="close" onClick={onClose} />
				</StandardTooltip>
			</div>
		</div>
		<div className="flex-1 p-4 pb-[60px] overflow-auto flex items-center justify-center" onWheel={onWheel}>
			<div
				style={{
					transform: `scale(${zoomLevel}) translate(${0}px, ${0}px)`,
					transformOrigin: "center center",
					transition: isDragging ? "none" : "transform 0.1s ease",
					cursor: isDragging ? "grabbing" : "grab",
				}}
				onMouseDown={onMouseDown}
				onMouseMove={onMouseMove}
				onMouseUp={onMouseUp}
				onMouseLeave={onMouseLeave}>
				<img src={imageUri} alt={alt} style={{ maxWidth: "90vw", maxHeight: "80vh", objectFit: "contain" }} />
			</div>
			<div className="absolute bottom-4 left-4 bg-vscode-editor-background border border-vscode-editorGroup-border rounded px-2 py-1 text-xs text-vscode-descriptionForeground pointer-events-none opacity-80">
				{Math.round(zoomLevel * 100)}%
			</div>
		</div>
		<div className="absolute bottom-0 right-0 left-0 p-3 flex items-center justify-end gap-2 bg-vscode-editor-background border-t border-vscode-editorGroup-border rounded-b">
			<ZoomControls
				zoomLevel={zoomLevel}
				zoomInTitle={t("common:mermaid.buttons.zoomIn")}
				zoomOutTitle={t("common:mermaid.buttons.zoomOut")}
				useContinuousZoom={true}
				adjustZoom={adjustZoom}
				zoomInStep={0.2}
				zoomOutStep={-0.2}
			/>
			{imagePath && (
				<StandardTooltip content={t("common:mermaid.buttons.copy")}>
					<IconButton icon={copyFeedback ? "check" : "copy"} onClick={onCopy} />
				</StandardTooltip>
			)}
			<StandardTooltip content={t("common:mermaid.buttons.save")}>
				<IconButton icon="save" onClick={onSave} />
			</StandardTooltip>
		</div>
	</Modal>
)
