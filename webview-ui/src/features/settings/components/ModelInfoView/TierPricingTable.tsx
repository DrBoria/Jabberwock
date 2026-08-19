import { useAppTranslation } from "@src/i18n/TranslationContext"
import { formatPrice } from "@src/utils/format/formatPrice"
import type { TierPricingTableProps } from "./types"

const getTierPrice = (
	modelInfo: TierPricingTableProps["modelInfo"],
	tierName: string,
	field: "inputPrice" | "outputPrice" | "cacheReadsPrice",
) => modelInfo?.tiers?.find((t) => t.name === tierName)?.[field] ?? modelInfo?.[field]

export const TierPricingTable = ({ modelInfo, allowedTierNames }: TierPricingTableProps) => {
	const { t } = useAppTranslation()
	const fmt = (n?: number) => (typeof n === "number" ? `${formatPrice(n)}` : "—")
	return (
		<div className="mt-2">
			<div className="text-xs text-vscode-descriptionForeground mb-1">
				{t("settings:serviceTier.pricingTableTitle")}
			</div>
			<div className="border border-vscode-dropdown-border rounded-xs overflow-hidden">
				<table className="w-full text-sm">
					<thead className="bg-vscode-dropdown-background">
						<tr>
							<th className="text-left px-3 py-1.5">{t("settings:serviceTier.columns.tier")}</th>
							<th className="text-right px-3 py-1.5">{t("settings:serviceTier.columns.input")}</th>
							<th className="text-right px-3 py-1.5">{t("settings:serviceTier.columns.output")}</th>
							<th className="text-right px-3 py-1.5">{t("settings:serviceTier.columns.cacheReads")}</th>
						</tr>
					</thead>
					<tbody>
						<tr className="border-t border-vscode-dropdown-border/60">
							<td className="px-3 py-1.5">{t("settings:serviceTier.standard")}</td>
							<td className="px-3 py-1.5 text-right">{fmt(modelInfo?.inputPrice)}</td>
							<td className="px-3 py-1.5 text-right">{fmt(modelInfo?.outputPrice)}</td>
							<td className="px-3 py-1.5 text-right">{fmt(modelInfo?.cacheReadsPrice)}</td>
						</tr>
						{allowedTierNames.includes("flex") && (
							<tr className="border-t border-vscode-dropdown-border/60">
								<td className="px-3 py-1.5">{t("settings:serviceTier.flex")}</td>
								<td className="px-3 py-1.5 text-right">
									{fmt(getTierPrice(modelInfo, "flex", "inputPrice"))}
								</td>
								<td className="px-3 py-1.5 text-right">
									{fmt(getTierPrice(modelInfo, "flex", "outputPrice"))}
								</td>
								<td className="px-3 py-1.5 text-right">
									{fmt(getTierPrice(modelInfo, "flex", "cacheReadsPrice"))}
								</td>
							</tr>
						)}
						{allowedTierNames.includes("priority") && (
							<tr className="border-t border-vscode-dropdown-border/60">
								<td className="px-3 py-1.5">{t("settings:serviceTier.priority")}</td>
								<td className="px-3 py-1.5 text-right">
									{fmt(getTierPrice(modelInfo, "priority", "inputPrice"))}
								</td>
								<td className="px-3 py-1.5 text-right">
									{fmt(getTierPrice(modelInfo, "priority", "outputPrice"))}
								</td>
								<td className="px-3 py-1.5 text-right">
									{fmt(getTierPrice(modelInfo, "priority", "cacheReadsPrice"))}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	)
}
