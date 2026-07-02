import { useAppTranslation } from "@/i18n/TranslationContext"
import { Input } from "@src/shared/ui/inputs/input"
import { SearchableSetting } from "../shared/SearchableSetting"
import { isValidImageSize } from "./helpers"

interface ImageSizeSettingsProps {
	maxImageFileSize?: number
	maxTotalImageSize?: number
	onChange: (field: string, value: number) => void
}

export const ImageSizeSettings = ({ maxImageFileSize, maxTotalImageSize, onChange }: ImageSizeSettingsProps) => {
	const { t } = useAppTranslation()
	return (
		<>
			<SearchableSetting
				settingId="context-max-image-file-size"
				section="contextManagement"
				label={t("settings:contextManagement.maxImageFileSize.label")}>
				<div className="flex flex-col gap-2">
					<span className="font-medium">{t("settings:contextManagement.maxImageFileSize.label")}</span>
					<div className="flex items-center gap-4">
						<Input
							type="number"
							pattern="[0-9]*"
							className="w-24 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border px-2 py-1 rounded text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
							value={maxImageFileSize ?? 5}
							min={1}
							max={100}
							onChange={(e) => {
								const v = parseInt(e.target.value, 10)
								if (isValidImageSize(v, 1, 100)) onChange("maxImageFileSize", v)
							}}
							onClick={(e) => e.currentTarget.select()}
							data-testid="max-image-file-size-input"
						/>
						<span>{t("settings:contextManagement.maxImageFileSize.mb")}</span>
					</div>
				</div>
				<div className="text-vscode-descriptionForeground text-sm mt-2">
					{t("settings:contextManagement.maxImageFileSize.description")}
				</div>
			</SearchableSetting>

			<SearchableSetting
				settingId="context-max-total-image-size"
				section="contextManagement"
				label={t("settings:contextManagement.maxTotalImageSize.label")}>
				<div className="flex flex-col gap-2">
					<span className="font-medium">{t("settings:contextManagement.maxTotalImageSize.label")}</span>
					<div className="flex items-center gap-4">
						<Input
							type="number"
							pattern="[0-9]*"
							className="w-24 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border px-2 py-1 rounded text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
							value={maxTotalImageSize ?? 20}
							min={1}
							max={500}
							onChange={(e) => {
								const v = parseInt(e.target.value, 10)
								if (isValidImageSize(v, 1, 500)) onChange("maxTotalImageSize", v)
							}}
							onClick={(e) => e.currentTarget.select()}
							data-testid="max-total-image-size-input"
						/>
						<span>{t("settings:contextManagement.maxTotalImageSize.mb")}</span>
					</div>
				</div>
				<div className="text-vscode-descriptionForeground text-sm mt-2">
					{t("settings:contextManagement.maxTotalImageSize.description")}
				</div>
			</SearchableSetting>
		</>
	)
}
