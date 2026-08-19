import { memo } from "react"

interface CircularProgressProps {
	progress: number
	size?: number
	strokeWidth?: number
}

/**
 * Small circular progress indicator used in the cost analysis section.
 *
 * @example
 * ```tsx
 * <CircularProgress progress={0.75} size={14} strokeWidth={2} />
 * ```
 * Displays a radial progress ring. When progress is 0, the circle
 * is drawn with reduced opacity to visually indicate "no cost".
 */
export const CircularProgress = memo(function CircularProgress({
	progress,
	size = 14,
	strokeWidth = 2,
}: CircularProgressProps) {
	const radius = (size - strokeWidth) / 2
	const circumference = 2 * Math.PI * radius
	const offset = circumference - progress * circumference

	return (
		<svg
			width={size}
			height={size}
			viewBox={`0 0 ${size} ${size}`}
			fill="none"
			className="shrink-0"
			role="progressbar"
			aria-valuenow={Math.round(progress * 100)}
			aria-valuemin={0}
			aria-valuemax={100}>
			<circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				stroke="currentColor"
				strokeWidth={strokeWidth}
				opacity={progress === 0 ? 0.15 : 0.2}
			/>
			<circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				stroke="currentColor"
				strokeWidth={strokeWidth}
				strokeLinecap="round"
				strokeDasharray={circumference}
				strokeDashoffset={offset}
				transform={`rotate(-90 ${size / 2} ${size / 2})`}
				opacity={progress === 0 ? 0.3 : 0.8}
			/>
		</svg>
	)
})
