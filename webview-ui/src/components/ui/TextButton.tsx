import React from "react"

interface TextButtonProps {
	children: React.ReactNode
	onClick?: () => void
	className?: string
	disabled?: boolean
}

/** Shared text-style button with consistent hover/underline styling */
export const TextButton: React.FC<TextButtonProps> = ({ children, onClick, className = "", disabled }) => (
	<button
		className={`cursor-pointer flex gap-1 items-center mt-2 text-vscode-descriptionForeground hover:text-vscode-descriptionForeground hover:underline font-normal ${className}`}
		onClick={onClick}
		disabled={disabled}>
		{children}
	</button>
)
