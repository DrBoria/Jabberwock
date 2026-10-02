import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"

import type { Language } from "@jabberwock/types"

import { LANGUAGES } from "@shared/core/language"

import { cn } from "@src/lib/utils"
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@src/shared/ui/selects/select-primitive"

import { SetCachedStateField } from "@src/features/settings/components/shared/types"
import { SectionHeader } from "@src/features/settings/components/shared/header"
import { Section } from "@src/features/settings/components/shared/section"
import { SearchableSetting } from "@src/features/settings/components/shared/SearchableSetting"

type LanguageSettingsProps = HTMLAttributes<HTMLDivElement> & {
	language: string
	setCachedStateField: SetCachedStateField<"language">
}

export const LanguageSettings = ({ language, setCachedStateField, className, ...props }: LanguageSettingsProps) => {
	const { t } = useAppTranslation()

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader>{t("settings:sections.language")}</SectionHeader>

			<Section>
				<SearchableSetting
					settingId="language-select"
					section="language"
					label={t("settings:sections.language")}>
					<Select
						value={language}
						onValueChange={(value) => setCachedStateField("language", value as Language)}>
						<SelectTrigger className="w-full">
							<SelectValue placeholder={t("settings:common.select")} />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{Object.entries(LANGUAGES).map(([code, name]) => (
									<SelectItem key={code} value={code}>
										{name}
										<span className="text-muted-foreground">({code})</span>
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</SearchableSetting>
			</Section>
		</div>
	)
}
