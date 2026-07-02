import type { ProviderName } from "@jabberwock/types"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { BookOpenText } from "lucide-react"
import { SearchableSelect } from "@src/shared/ui/selects/searchable-select"
import { JabberwockBalanceDisplay } from "../../providers/balance-displays/JabberwockBalanceDisplay"
import type { ProviderHeaderSectionProps } from "../types"

export const ProviderHeaderSection = ({
	t,
	selectedProvider,
	cloudIsAuthenticated,
	docs,
	providerOptions,
	onProviderChange,
}: ProviderHeaderSectionProps) => (
	<div className="flex flex-col gap-1 relative">
		<div className="flex justify-between items-center">
			<label className="block font-medium">{t("settings:providers.apiProvider")}</label>
			{selectedProvider === "jabberwock" && cloudIsAuthenticated ? (
				<JabberwockBalanceDisplay />
			) : (
				docs && (
					<VSCodeLink href={docs.url} target="_blank" className="flex gap-2">
						{t("settings:providers.apiProviderDocs")}
						<BookOpenText className="size-4 inline ml-2" />
					</VSCodeLink>
				)
			)}
		</div>
		<SearchableSelect
			value={selectedProvider}
			onValueChange={(value) => onProviderChange(value as ProviderName)}
			options={providerOptions}
			placeholder={t("settings:common.select")}
			searchPlaceholder={t("settings:providers.searchProviderPlaceholder")}
			emptyMessage={t("settings:providers.noProviderMatchFound")}
			className="w-full"
			data-testid="provider-select"
		/>
	</div>
)
