import * as React from "react"
import { useTranslation } from "react-i18next"
import { X } from "lucide-react"
import type { DropdownSearchProps } from "../selects/select-dropdown-utils"

export const DropdownSearch: React.FC<DropdownSearchProps> = ({ searchValue, onSearchChange, onClearSearch }) => {
	const { t } = useTranslation()
	const ref = React.useRef<HTMLInputElement>(null)
	React.useEffect(() => {
		ref.current?.focus()
	}, [])
	return (
		<div className="relative p-2 border-b border-vscode-dropdown-border">
			<input
				aria-label="Search"
				ref={ref}
				value={searchValue}
				onChange={(e) => onSearchChange(e.target.value)}
				placeholder={t("common:ui.search_placeholder")}
				className="w-full h-8 px-2 py-1 text-xs bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded focus:outline-0"
			/>
			{searchValue.length > 0 && (
				<div className="absolute right-4 top-0 bottom-0 flex items-center justify-center">
					<X
						className="text-vscode-input-foreground opacity-50 hover:opacity-100 size-4 p-0.5 cursor-pointer"
						onClick={onClearSearch}
					/>
				</div>
			)}
		</div>
	)
}
