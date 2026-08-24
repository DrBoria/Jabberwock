import { IconButton } from "../ui/button/IconButton"
import { useRef, useEffect } from "react"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"

interface ZoomControlsProps {
	zoomLevel: number
	zoomInTitle?: string
	zoomOutTitle?: string
	useContinuousZoom?: boolean
	adjustZoom?: (amount: number) => void
	zoomInStep?: number
	zoomOutStep?: number
	onZoomIn?: () => void
	onZoomOut?: () => void
}

interface ZoomButtonProps {
	icon: "zoom-out" | "zoom-in"
	tooltip?: string
	useContinuousZoom: boolean
	adjustZoom?: (amount: number) => void
	step: number
	onClick?: () => void
}

function ZoomButton({ icon, tooltip, useContinuousZoom, adjustZoom, step, onClick }: ZoomButtonProps) {
	const intervalRef = useRef<NodeJS.Timeout | null>(null)

	const startContinuous = () => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current)
		}
		adjustZoom?.(step)
		intervalRef.current = setInterval(() => {
			adjustZoom?.(step)
		}, 150)
	}

	const stopContinuous = () => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current)
			intervalRef.current = null
		}
	}

	useEffect(() => {
		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current)
			}
		}
	}, [])

	const isContinuous = useContinuousZoom && !!adjustZoom
	const handleClick = isContinuous ? undefined : onClick || (() => adjustZoom?.(step))

	return (
		<StandardTooltip content={tooltip}>
			<IconButton
				icon={icon}
				onClick={handleClick}
				onMouseDown={isContinuous ? startContinuous : undefined}
				onMouseUp={isContinuous ? stopContinuous : undefined}
				onMouseLeave={isContinuous ? stopContinuous : undefined}
			/>
		</StandardTooltip>
	)
}

export function ZoomControls({
	zoomLevel,
	zoomInTitle,
	zoomOutTitle,
	useContinuousZoom = false,
	adjustZoom,
	zoomInStep = 0.1,
	zoomOutStep = -0.1,
	onZoomIn,
	onZoomOut,
}: ZoomControlsProps) {
	return (
		<div className="flex items-center gap-2">
			<ZoomButton
				icon="zoom-out"
				tooltip={zoomOutTitle}
				useContinuousZoom={useContinuousZoom}
				adjustZoom={adjustZoom}
				step={zoomOutStep}
				onClick={onZoomOut}
			/>
			<div className="text-sm text-vscode-editor-foreground min-w-[50px] text-center">
				{Math.round(zoomLevel * 100)}%
			</div>
			<ZoomButton
				icon="zoom-in"
				tooltip={zoomInTitle}
				useContinuousZoom={useContinuousZoom}
				adjustZoom={adjustZoom}
				step={zoomInStep}
				onClick={onZoomIn}
			/>
		</div>
	)
}
