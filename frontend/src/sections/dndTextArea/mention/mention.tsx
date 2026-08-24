import { mentionRegexGlobal } from "@shared/context/mentions"

import { rootStore } from "@src/features/store"

interface MentionProps {
	text?: string
	withShadow?: boolean
}

// Regex to match @Goal #N patterns (e.g., @Goal #1, @Goal #42)
const goalMentionRegex = /@Goal\s+#(\d+)/g

export const Mention = ({ text, withShadow = false }: MentionProps) => {
	if (!text) {
		return <>{text}</>
	}

	// First, split by standard mentions (files, git, etc.)
	const parts: React.ReactNode[] = []
	let lastIndex = 0

	// Process goal mentions separately
	let match: RegExpExecArray | null

	// Reset regex state
	goalMentionRegex.lastIndex = 0

	while ((match = goalMentionRegex.exec(text)) !== null) {
		// Add text before this match
		if (match.index > lastIndex) {
			const beforeText = text.slice(lastIndex, match.index)
			// Process standard mentions within the before-text
			const beforeParts = beforeText.split(mentionRegexGlobal).map((part, i) => {
				if (i % 2 === 0) return part
				return (
					<span
						key={`mention-${lastIndex}-${i}`}
						className={`${withShadow ? "mention-context-highlight-with-shadow" : "mention-context-highlight"} text-[0.9em] cursor-pointer`}
						onClick={() => rootStore.settings.openMention(part)}>
						@{part}
					</span>
				)
			})
			parts.push(...beforeParts)
		}

		// Add the goal mention
		const goalNum = match[1]
		const fullMatch = match[0]
		parts.push(
			<span
				key={`goal-${match.index}`}
				className={`${withShadow ? "mention-context-highlight-with-shadow" : "mention-context-highlight"} text-[0.9em] cursor-pointer`}
				title={`Goal #${goalNum}`}>
				{fullMatch}
			</span>,
		)

		lastIndex = match.index + fullMatch.length
	}

	// Add remaining text after last goal mention
	if (lastIndex < text.length) {
		const remainingText = text.slice(lastIndex)
		const remainingParts = remainingText.split(mentionRegexGlobal).map((part, i) => {
			if (i % 2 === 0) return part
			return (
				<span
					key={`mention-end-${i}`}
					className={`${withShadow ? "mention-context-highlight-with-shadow" : "mention-context-highlight"} text-[0.9em] cursor-pointer`}
					onClick={() => rootStore.settings.openMention(part)}>
					@{part}
				</span>
			)
		})
		parts.push(...remainingParts)
	}

	// If no goal mentions were found, fall back to the original behavior
	if (lastIndex === 0) {
		const originalParts = text.split(mentionRegexGlobal).map((part, index) => {
			if (index % 2 === 0) {
				return part
			} else {
				return (
					<span
						key={index}
						className={`${withShadow ? "mention-context-highlight-with-shadow" : "mention-context-highlight"} text-[0.9em] cursor-pointer`}
						onClick={() => rootStore.settings.openMention(part)}>
						@{part}
					</span>
				)
			}
		})
		return <>{originalParts}</>
	}

	return <>{parts}</>
}
