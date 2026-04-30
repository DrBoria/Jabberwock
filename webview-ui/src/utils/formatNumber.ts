import i18next from "i18next"

export function formatLargeNumber(num: number): string {
	if (num >= 1e9) {
		return (num / 1e9).toFixed(1) + i18next.t("common:number_format.billion_suffix")
	}
	if (num >= 1e6) {
		return (num / 1e6).toFixed(1) + i18next.t("common:number_format.million_suffix")
	}
	if (num >= 1e3) {
		return (num / 1e3).toFixed(1) + i18next.t("common:number_format.thousand_suffix")
	}
	return num.toString()
}
