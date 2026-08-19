import type { ModelWithTotalPrice } from "@/lib/types/models"
import { formatCurrency, formatTokens } from "@/lib/formatters"
import {
	ArrowLeftToLine,
	ArrowRightToLine,
	Building2,
	Check,
	Expand,
	Gift,
	HardDriveDownload,
	HardDriveUpload,
	RulerDimensionLine,
	ChevronDown,
	ChevronUp,
} from "lucide-react"
import { useState } from "react"

interface ModelCardProps {
	model: ModelWithTotalPrice
}

function formatPrice(price: number): string {
	if (price === 0) return "Free"
	return `${formatCurrency(price)}/1M tokens`
}

function mobileRowClass(expanded: boolean): string {
	if (expanded) return "table-row"
	return "hidden sm:table-row"
}

function CachePriceRow({
	label,
	price,
	Icon,
	expanded,
}: {
	label: string
	price: number
	Icon: React.ComponentType<{ className?: string }>
	expanded: boolean
}) {
	if (price <= 0) return null

	return (
		<tr className={["border-b border-border", mobileRowClass(expanded)].join(" ")}>
			<td className="py-1.5 font-medium text-muted-foreground">
				<Icon className="size-4 inline-block mr-1.5" />
				{label}
			</td>
			<td className="py-1.5 text-right">{formatCurrency(price)}/1M tokens</td>
		</tr>
	)
}

function FeaturesRow({ tags, expanded }: { tags: string[]; expanded: boolean }) {
	if (tags.length === 0) return null

	return (
		<tr className={mobileRowClass(expanded)}>
			<td className="py-1.5 font-medium text-muted-foreground align-top">Features</td>
			<td className="py-1.5">
				{tags.map((tag) => (
					<span key={tag} className="flex justify-end items-center text-xs capitalize">
						<Check className="size-3 m-1" />
						{tag}
					</span>
				))}
			</td>
		</tr>
	)
}

function MobileToggleRow({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
	return (
		<tr className="sm:hidden">
			<td colSpan={2} className="pt-3">
				<button
					type="button"
					onClick={onToggle}
					className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium text-primary">
					{expanded ? "Less" : "More"}
					{expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
				</button>
			</td>
		</tr>
	)
}

export function ModelCard({ model }: ModelCardProps) {
	const inputPrice = parseFloat(model.pricing.input) * 1_000_000
	const outputPrice = parseFloat(model.pricing.output) * 1_000_000
	const cacheReadPrice = parseFloat(model.pricing.input_cache_read || "0") * 1_000_000
	const cacheWritePrice = parseFloat(model.pricing.input_cache_write || "0") * 1_000_000

	const free = model.tags.includes("free")
	const displayTags = model.tags.filter((tag) => tag === "vision" || tag === "reasoning")

	const [expanded, setExpanded] = useState(false)

	return (
		<div className="relative cursor-default px-8 pt-7 pb-5 flex flex-col justify-start bg-background border rounded-3xl transition-all hover:shadow-xl sm:cursor-default">
			<div className="mb-4">
				<h3 className="text-xl font-semibold tracking-tight mb-2 flex items-center gap-2 justify-between">
					{model.name}
					{free && (
						<span className="inline-flex items-center text-sm font-medium text-green-500">
							<Gift className="size-4 mr-1" />
							Free!
						</span>
					)}
				</h3>
				<p
					className={["text-sm text-muted-foreground", "sm:line-clamp-none", !expanded ? "line-clamp-2" : ""]
						.join(" ")
						.trim()}>
					{model.description}
				</p>
			</div>

			<div className="overflow-x-auto mt-auto">
				<table className="w-full text-xs">
					<tbody>
						{model.owned_by && (
							<tr className="border-b border-border">
								<td className="py-1.5 font-medium text-muted-foreground">
									<Building2 className="size-4 inline-block mr-1.5" />
									Provider
								</td>
								<td className="py-1.5 text-right">{model.owned_by}</td>
							</tr>
						)}

						<tr className="border-b border-border">
							<td className="py-1.5 font-medium text-muted-foreground">
								<RulerDimensionLine className="size-4 inline-block mr-1.5" />
								Context Window
							</td>
							<td className="py-1.5 text-right font-mono">{formatTokens(model.context_window)}</td>
						</tr>

						<tr className={["border-b border-border", mobileRowClass(expanded)].join(" ")}>
							<td className="py-1.5 font-medium text-muted-foreground">
								<Expand className="size-4 inline-block mr-1.5" />
								Max Output Tokens
							</td>
							<td className="py-1.5 text-right font-mono">{formatTokens(model.max_tokens)}</td>
						</tr>

						<tr className="border-b border-border">
							<td className="py-1.5 font-medium text-muted-foreground">
								<ArrowRightToLine className="size-4 inline-block mr-1.5" />
								Input Price
							</td>
							<td className="py-1.5 text-right">{formatPrice(inputPrice)}</td>
						</tr>

						<tr className="border-b border-border">
							<td className="py-1.5 font-medium text-muted-foreground">
								<ArrowLeftToLine className="size-4 inline-block mr-1.5" />
								Output Price
							</td>
							<td className="py-1.5 text-right">{formatPrice(outputPrice)}</td>
						</tr>

						<CachePriceRow
							label="Cache Read"
							price={cacheReadPrice}
							Icon={HardDriveUpload}
							expanded={expanded}
						/>
						<CachePriceRow
							label="Cache Write"
							price={cacheWritePrice}
							Icon={HardDriveDownload}
							expanded={expanded}
						/>

						<FeaturesRow tags={displayTags} expanded={expanded} />

						<MobileToggleRow expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
					</tbody>
				</table>
			</div>
		</div>
	)
}
