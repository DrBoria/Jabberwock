import { cn } from "@/lib/utils"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { forwardRef, useCallback, useRef, ReactNode, ComponentRef, ComponentProps } from "react"

export interface VSCodeTextFieldWithNodesProps extends ComponentProps<typeof VSCodeTextField> {
	leftNodes?: ReactNode[]
	rightNodes?: ReactNode[]
}

const findInputElement = (element: unknown): HTMLInputElement | null => {
	if (!(element instanceof HTMLElement)) return null
	const root = element.shadowRoot ? element.shadowRoot : element
	const input = root.querySelector("input")
	return input instanceof HTMLInputElement ? input : null
}

function VSCodeTextFieldWithNodesInner(
	props: VSCodeTextFieldWithNodesProps,
	forwardedRef: React.Ref<HTMLInputElement>,
) {
	const { className, style, "data-testid": dataTestId, leftNodes, rightNodes, ...restProps } = props

	const inputRef = useRef<HTMLInputElement | null>(null)

	// Callback ref to get access to the underlying input element.
	// VSCodeTextField doesn't expose this directly so we have to query for it!
	const handleVSCodeFieldRef = useCallback(
		(element: ComponentRef<typeof VSCodeTextField>) => {
			const inputElement = findInputElement(element)
			if (!inputElement) return

			inputRef.current = inputElement
			if (typeof forwardedRef === "function") {
				forwardedRef(inputElement)
			} else if (forwardedRef) {
				;(forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = inputElement
			}
		},
		[forwardedRef],
	)

	const focusInput = useCallback(async () => {
		if (inputRef.current && document.activeElement !== inputRef.current) {
			setTimeout(() => {
				inputRef.current?.focus()
			})
		}
	}, [])

	const hasLeftNodes = leftNodes && leftNodes.filter(Boolean).length > 0
	const hasRightNodes = rightNodes && rightNodes.filter(Boolean).length > 0

	return (
		<div
			className={cn(
				`group`,
				`relative flex items-center cursor-text`,
				`bg-[var(--input-background)] text-[var(--input-foreground)]`,
				`rounded-[calc(var(--corner-radius-round)*1px)]`,
				className,
			)}
			style={style}
			onMouseDown={focusInput}>
			{hasLeftNodes && (
				<div className="absolute left-2 z-10 flex items-center gap-1 pointer-events-none">{leftNodes}</div>
			)}

			<VSCodeTextField
				data-testid={dataTestId}
				ref={handleVSCodeFieldRef}
				style={{
					flex: 1,
					paddingLeft: hasLeftNodes ? "24px" : undefined,
					paddingRight: hasRightNodes ? "24px" : undefined,
				}}
				className="[--border-width:0]"
				{...restProps}
			/>

			{hasRightNodes && (
				<div className="absolute right-2 z-10 flex items-center gap-1 pointer-events-none">{rightNodes}</div>
			)}

			{/* Absolutely positioned focus border overlay */}
			<div className="absolute top-0 left-0 size-full border border-vscode-input-border group-focus-within:border-[var(--focus-border)] rounded"></div>
		</div>
	)
}

export const DecoratedVSCodeTextField = forwardRef(VSCodeTextFieldWithNodesInner)
