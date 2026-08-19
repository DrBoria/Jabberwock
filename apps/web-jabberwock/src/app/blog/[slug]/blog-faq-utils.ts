import type { FAQItem } from "@/components/blog/BlogFAQ"

interface FAQSection {
	faqContent: string
	beforeFAQ: string
	afterFAQ: string
}

export function findFAQSection(content: string): FAQSection | null {
	const faqSectionRegex = /^## Frequently asked questions\s*$/im
	const faqMatch = content.match(faqSectionRegex)

	if (!faqMatch || faqMatch.index === undefined) {
		return null
	}

	const faqStartIndex = faqMatch.index
	const beforeFAQ = content.slice(0, faqStartIndex).trim()
	const faqSection = content.slice(faqStartIndex)

	const nextH2Match = faqSection.slice(faqMatch[0].length).match(/^## /m)
	const hasNextH2 = nextH2Match && nextH2Match.index !== undefined

	const faqContent = hasNextH2 ? faqSection.slice(0, faqMatch[0].length + (nextH2Match?.index ?? 0)) : faqSection

	const afterFAQ = hasNextH2 ? faqSection.slice(faqMatch[0].length + (nextH2Match?.index ?? 0)) : ""

	return { faqContent, beforeFAQ, afterFAQ }
}

export function parseFAQItems(faqContent: string): FAQItem[] {
	const faqItems: FAQItem[] = []
	const questionRegex = /^### (.+?)$\s*([\s\S]*?)(?=^### |$(?![\s\S]))/gm
	let match

	while ((match = questionRegex.exec(faqContent)) !== null) {
		const question = match[1]?.trim()
		const answer = match[2]?.trim()
		if (question && answer) {
			faqItems.push({ question, answer })
		}
	}

	return faqItems
}

export function parseFAQFromMarkdown(content: string): {
	faqItems: FAQItem[]
	contentWithoutFAQ: string
} {
	const section = findFAQSection(content)

	if (!section) {
		return { faqItems: [], contentWithoutFAQ: content }
	}

	const faqItems = parseFAQItems(section.faqContent)
	const contentWithoutFAQ = (section.beforeFAQ + "\n\n" + section.afterFAQ).trim()

	return { faqItems, contentWithoutFAQ }
}
