import React from "react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { IconButton } from "../ui/button/IconButton"
import { ZoomControls } from "../image/ZoomControls"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"

interface MermaidActionButtonsProps {
	onZoom?: (e: React.MouseEvent) => void
	onZoomIn?: () => void
	onZoomOut?: () => void
	onCopy: (e: React.MouseEvent) => void
	onSave?: (e: React.MouseEvent) => void
	onViewCode: () => void
	onClose?: () => void
	copyFeedback: boolean
	showZoomControls?: boolean
	zoomLevel?: number
}

const handleViewCodeClick = (e: React.MouseEvent, onViewCode: () => void) => {
	e.stopPropagation()
	onViewCode()
}

const ZoomActionButtons: React.FC<{
	zoomLevel: number
	onZoomIn: () => void
	onZoomOut: () => void
	onCopy: (e: React.MouseEvent) => void
	onViewCode: () => void
	copyFeedback: boolean
	t: (key: string) => string
}> = ({ zoomLevel, onZoomIn, onZoomOut, onCopy, onViewCode, copyFeedback, t }) => (
	<>
		<ZoomControls
			zoomLevel={zoomLevel}
			onZoomIn={onZoomIn}
			onZoomOut={onZoomOut}
			zoomInTitle={t("common:mermaid.buttons.zoomIn")}
			zoomOutTitle={t("common:mermaid.buttons.zoomOut")}
		/>
		<StandardTooltip content={t("common:mermaid.buttons.viewCode")}>
			<IconButton icon="code" onClick={(e: React.MouseEvent) => handleViewCodeClick(e, onViewCode)} />
		</StandardTooltip>
		<StandardTooltip content={t("common:mermaid.buttons.copy")}>
			<IconButton icon={copyFeedback ? "check" : "copy"} onClick={onCopy} />
		</StandardTooltip>
	</>
)

const DefaultActionButtons: React.FC<{
	onZoom: ((e: React.MouseEvent) => void) | undefined
	onCopy: (e: React.MouseEvent) => void
	onSave: ((e: React.MouseEvent) => void) | undefined
	onViewCode: () => void
	onClose: (() => void) | undefined
	copyFeedback: boolean
	t: (key: string) => string
}> = ({ onZoom, onCopy, onSave, onViewCode, onClose, copyFeedback, t }) => (
	<>
		{onZoom && (
			<StandardTooltip content={t("common:mermaid.buttons.zoom")}>
				<IconButton icon="zoom-in" onClick={onZoom} />
			</StandardTooltip>
		)}
		<StandardTooltip content={t("common:mermaid.buttons.viewCode")}>
			<IconButton icon="code" onClick={(e: React.MouseEvent) => handleViewCodeClick(e, onViewCode)} />
		</StandardTooltip>
		<StandardTooltip content={t("common:mermaid.buttons.copy")}>
			<IconButton icon={copyFeedback ? "check" : "copy"} onClick={onCopy} />
		</StandardTooltip>
		{onSave && (
			<StandardTooltip content={t("common:mermaid.buttons.save")}>
				<IconButton icon="save" onClick={onSave} />
			</StandardTooltip>
		)}
		{onClose && (
			<StandardTooltip content={t("common:mermaid.buttons.close")}>
				<IconButton icon="close" onClick={onClose} />
			</StandardTooltip>
		)}
	</>
)
export const MermaidActionButtons: React.FC<MermaidActionButtonsProps> = ({
	onZoom,
	onZoomIn,
	onZoomOut,
	onCopy,
	onSave,
	onViewCode,
	onClose,
	copyFeedback,
	showZoomControls = false,
	zoomLevel,
}) => {
	const { t } = useAppTranslation()

	const hasZoomControls = showZoomControls && onZoomOut && onZoomIn && zoomLevel !== undefined
	if (hasZoomControls) {
		return (
			<ZoomActionButtons
				zoomLevel={zoomLevel}
				onZoomIn={onZoomIn}
				onZoomOut={onZoomOut}
				onCopy={onCopy}
				onViewCode={onViewCode}
				copyFeedback={copyFeedback}
				t={t}
			/>
		)
	}

	return (
		<DefaultActionButtons
			onZoom={onZoom}
			onCopy={onCopy}
			onSave={onSave}
			onViewCode={onViewCode}
			onClose={onClose}
			copyFeedback={copyFeedback}
			t={t}
		/>
	)
}
