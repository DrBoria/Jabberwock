import React from "react"
import type { MarketplaceItem } from "@jabberwock/types"

export const SuccessContent: React.FC<{
	item: MarketplaceItem
	t: (key: string, options?: Record<string, unknown>) => string
}> = ({ item, t }) => {
	const isMcp = item.type === "mcp"
	return (
		<div className="space-y-4 py-2">
			<div className="text-center space-y-4">
				<div className="text-green-500 text-lg">✓ {t("marketplace:install.installed")}</div>
				<p className="text-sm text-muted-foreground">
					{isMcp ? t("marketplace:install.whatNextMcp") : t("marketplace:install.whatNextMode")}
				</p>
			</div>
		</div>
	)
}
