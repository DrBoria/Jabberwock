import { memo } from "react"
import { useCopyToClipboard } from "@sections/dndTextArea/utils/clipboard/clipboard"
import { normalizeLanguage } from "@src/utils/text/highlighter-engine"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { ChevronDown, ChevronUp, Copy, Check } from "lucide-react"
import { StandardTooltip } from "@src/shared/ui/tooltips/standard-tooltip"
import type { CodeBlockProps } from "./CodeBlock.constants"
import { CodeBlockButton, CodeBlockButtonWrapper, CodeBlockContainer, MemoizedStyledPre } from "./CodeBlock.components"
import { useCodeBlock } from "./CodeBlock.hooks"

const CodeBlock = memo(
	({ source, rawSource, language, preStyle, initialWordWrap = true, collapsedHeight }: CodeBlockProps) => {
		const wordWrap = initialWordWrap,
			currentLanguage = normalizeLanguage(language)
		const { showCopyFeedback, copyWithFeedback } = useCopyToClipboard(),
			{ t } = useAppTranslation()

		const {
			codeBlockRef,
			preRef,
			copyButtonWrapperRef,
			highlightedCode,
			windowShade,
			showCollapseButton,
			isSelecting,
			handleCopy,
			handleToggleWindowShade,
			updateCodeBlockButtonPosition,
		} = useCodeBlock(source, rawSource, currentLanguage, copyWithFeedback)

		if (source?.length === 0) return null

		return (
			<CodeBlockContainer ref={codeBlockRef as React.Ref<HTMLDivElement>}>
				<MemoizedStyledPre
					preRef={preRef}
					preStyle={preStyle}
					wordWrap={wordWrap}
					windowShade={windowShade}
					collapsedHeight={collapsedHeight}
					highlightedCode={highlightedCode}
					updateCodeBlockButtonPosition={updateCodeBlockButtonPosition}
				/>
				{!isSelecting && (
					<CodeBlockButtonWrapper
						ref={copyButtonWrapperRef as React.Ref<HTMLDivElement>}
						onMouseOver={() => updateCodeBlockButtonPosition()}
						style={{ gap: 0 }}>
						{showCollapseButton && (
							<StandardTooltip
								content={t(`chat:codeblock.tooltips.${windowShade ? "expand" : "collapse"}`)}
								side="top">
								<CodeBlockButton onClick={handleToggleWindowShade}>
									{windowShade ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
								</CodeBlockButton>
							</StandardTooltip>
						)}
						<StandardTooltip content={t("chat:codeblock.tooltips.copy_code")} side="top">
							<CodeBlockButton onClick={handleCopy}>
								{showCopyFeedback ? <Check size={16} /> : <Copy size={16} />}
							</CodeBlockButton>
						</StandardTooltip>
					</CodeBlockButtonWrapper>
				)}
			</CodeBlockContainer>
		)
	},
)

export default CodeBlock
