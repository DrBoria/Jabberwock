import React from "react"

export const IconActivity = ({ size, color }: { size: number; color: string }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke={color}
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round">
		<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
	</svg>
)

export const IconChevronDown = ({ size }: { size: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round">
		<polyline points="6 9 12 15 18 9" />
	</svg>
)

export const IconChevronUp = ({ size }: { size: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round">
		<polyline points="18 15 12 9 6 15" />
	</svg>
)

export const IconTrash = ({ size }: { size: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round">
		<polyline points="3 6 5 6 21 6" />
		<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
	</svg>
)

export const IconShare = ({ size }: { size: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round">
		<circle cx="18" cy="5" r="3" />
		<circle cx="6" cy="12" r="3" />
		<circle cx="18" cy="19" r="3" />
		<line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
		<line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
	</svg>
)

export const IconTerminal = ({ size }: { size: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round">
		<polyline points="4 17 10 11 4 5" />
		<line x1="12" y1="19" x2="20" y2="19" />
	</svg>
)

export const IconZap = ({ size }: { size: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round">
		<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
	</svg>
)

export const IconDatabase = ({ size }: { size: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round">
		<ellipse cx="12" cy="5" rx="9" ry="3" />
		<path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
		<path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
	</svg>
)

export const IconCpu = ({ size }: { size: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round">
		<rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
		<rect x="9" y="9" width="6" height="6" />
		<line x1="9" y1="1" x2="9" y2="4" />
		<line x1="15" y1="1" x2="15" y2="4" />
		<line x1="9" y1="20" x2="9" y2="23" />
		<line x1="15" y1="20" x2="15" y2="23" />
		<line x1="20" y1="9" x2="23" y2="9" />
		<line x1="20" y1="14" x2="23" y2="14" />
		<line x1="1" y1="9" x2="4" y2="9" />
		<line x1="1" y1="14" x2="4" y2="14" />
	</svg>
)
