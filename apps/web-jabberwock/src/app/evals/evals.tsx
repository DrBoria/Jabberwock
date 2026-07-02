"use client"

import { useMemo } from "react"

import { formatTokens, formatCurrency, formatDuration, formatScore } from "@/lib"
import { useOpenRouterModels } from "@/lib/hooks"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui"
import type { ModelInfo } from "@jabberwock/types"

import type { EvalRun } from "./types"
import { Plot } from "./plot"

function resolveModelLabel(run: EvalRun): string {
	if (run.name) return run.name
	if (run.description) return run.description
	return run.model
}

function resolveRunDescription(run: EvalRun, modelInfo: ModelInfo | undefined): string | null {
	if (run.description) return run.description
	if (modelInfo) return modelInfo.description ?? null
	return null
}

function resolveContextWindow(run: EvalRun, modelInfo: ModelInfo | undefined): number | null {
	if (run.contextWindow) return run.contextWindow
	if (modelInfo) return modelInfo.contextWindow ?? null
	return null
}

function resolveInputPrice(run: EvalRun, modelInfo: ModelInfo | undefined): number | null {
	if (run.inputPrice) return run.inputPrice
	if (modelInfo) return modelInfo.inputPrice ?? null
	return null
}

function resolveOutputPrice(run: EvalRun, modelInfo: ModelInfo | undefined): number | null {
	if (run.outputPrice) return run.outputPrice
	if (modelInfo) return modelInfo.outputPrice ?? null
	return null
}

type OpenRouterModelsMap = Record<string, { modelInfo: ModelInfo }>

function enrichRun(run: EvalRun, openRouterModels: OpenRouterModelsMap | undefined) {
	const modelId = run.modelId
	const openRouterModelInfo = modelId && openRouterModels ? openRouterModels[modelId]?.modelInfo : undefined

	return {
		...run,
		label: resolveModelLabel(run),
		cost: run.taskMetrics.cost,
		description: resolveRunDescription(run, openRouterModelInfo),
		contextWindow: resolveContextWindow(run, openRouterModelInfo),
		inputPrice: resolveInputPrice(run, openRouterModelInfo),
		outputPrice: resolveOutputPrice(run, openRouterModelInfo),
	}
}

function getLanguageScore(
	scores: EvalRun["languageScores"],
	lang: keyof NonNullable<EvalRun["languageScores"]>,
): number {
	if (scores) {
		return scores[lang] ?? 0
	}
	return 0
}

function LanguageScoreCell({
	scores,
	lang,
}: {
	scores: EvalRun["languageScores"]
	lang: keyof NonNullable<EvalRun["languageScores"]>
}) {
	return <TableCell className="text-muted-foreground">{formatScore(getLanguageScore(scores, lang))}%</TableCell>
}

export function Evals({ runs }: { runs: EvalRun[] }) {
	const { data: openRouterModels } = useOpenRouterModels()

	const tableData: (EvalRun & { label: string; cost: number })[] = useMemo(
		() => runs.map((run) => enrichRun(run, openRouterModels)),
		[runs, openRouterModels],
	)

	return (
		<div className="mx-auto flex max-w-screen-lg flex-col gap-8 p-8">
			<div className="flex flex-col gap-4">
				<div>
					Jabberwock tests each frontier model against{" "}
					<a href="https://github.com/JabberwockInc/Jabberwock-Evals" className="underline">
						a suite of hundreds of exercises
					</a>{" "}
					across 5 programming languages with varying difficulty. These results can help you find the right
					price-to-intelligence ratio for your use case.
				</div>
				<div>
					Want to see the results for a model we haven&apos;t tested yet? Ping us in{" "}
					<a href="https://discord.gg/jabberwock" className="underline">
						Discord
					</a>
					.
				</div>
			</div>
			<Table className="border">
				<TableHeader>
					<TableRow>
						<TableHead colSpan={2} className="border-r text-center">
							Model
						</TableHead>
						<TableHead colSpan={3} className="border-r text-center">
							Metrics
						</TableHead>
						<TableHead colSpan={6} className="text-center">
							Scores
						</TableHead>
					</TableRow>
					<TableRow>
						<TableHead>
							Name
							<div className="text-xs opacity-50">Context Window</div>
						</TableHead>
						<TableHead className="border-r">
							Price
							<div className="text-xs opacity-50">In / Out</div>
						</TableHead>
						<TableHead>Duration</TableHead>
						<TableHead>
							Tokens
							<div className="text-xs opacity-50">In / Out</div>
						</TableHead>
						<TableHead className="border-r">
							Cost
							<div className="text-xs opacity-50">USD</div>
						</TableHead>
						<TableHead>
							<i className="devicon-go-plain text-lg" title="Go" />
						</TableHead>
						<TableHead>
							<i className="devicon-java-plain text-lg" title="Java" />
						</TableHead>
						<TableHead>
							<i className="devicon-javascript-plain text-lg" title="JavaScript" />
						</TableHead>
						<TableHead>
							<i className="devicon-python-plain text-lg" title="Python" />
						</TableHead>
						<TableHead>
							<i className="devicon-rust-original text-lg" title="Rust" />
						</TableHead>
						<TableHead>Total</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody className="font-mono">
					{tableData.map((run) => (
						<TableRow key={run.id}>
							<TableCell title={run.description ?? undefined}>
								<div className="font-sans">{run.label}</div>
								<div className="text-xs opacity-50">{formatTokens(run.contextWindow)}</div>
							</TableCell>
							<TableCell className="border-r">
								<div className="flex flex-row gap-2">
									<div>{formatCurrency(run.inputPrice)}</div>
									<div className="opacity-25">/</div>
									<div>{formatCurrency(run.outputPrice)}</div>
								</div>
							</TableCell>
							<TableCell className="font-mono">{formatDuration(run.taskMetrics.duration)}</TableCell>
							<TableCell>
								<div className="flex flex-row gap-2">
									<div>{formatTokens(run.taskMetrics.tokensIn)}</div>
									<div className="opacity-25">/</div>
									<div>{formatTokens(run.taskMetrics.tokensOut)}</div>
								</div>
							</TableCell>
							<TableCell className="border-r">{formatCurrency(run.taskMetrics.cost)}</TableCell>
							<LanguageScoreCell scores={run.languageScores} lang="go" />
							<LanguageScoreCell scores={run.languageScores} lang="java" />
							<LanguageScoreCell scores={run.languageScores} lang="javascript" />
							<LanguageScoreCell scores={run.languageScores} lang="python" />
							<LanguageScoreCell scores={run.languageScores} lang="rust" />
							<TableCell className="font-bold">{run.score}%</TableCell>
						</TableRow>
					))}
				</TableBody>
				<TableCaption>
					<Plot tableData={tableData} />
				</TableCaption>
			</Table>
		</div>
	)
}
