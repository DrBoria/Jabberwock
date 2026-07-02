"use client"

import { Info } from "lucide-react"

import {
	FormField,
	FormItem,
	FormLabel,
	FormControl,
	FormMessage,
	Slider,
	Label,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui"

import {
	CONCURRENCY_MIN,
	CONCURRENCY_MAX,
	TIMEOUT_MIN,
	TIMEOUT_MAX,
	ITERATIONS_MIN,
	ITERATIONS_MAX,
} from "@/lib/schemas"
import type { UseFormReturn } from "react-hook-form"
import type { CreateRun } from "@/lib/schemas"

export function NewRunSliderSection({ form }: { form: UseFormReturn<CreateRun> }) {
	return (
		<>
			<div className="grid grid-cols-3 gap-4 py-5">
				<FormField
					control={form.control}
					name="concurrency"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Concurrency</FormLabel>
							<FormControl>
								<div className="flex flex-row items-center gap-2">
									<Slider
										value={[field.value]}
										min={CONCURRENCY_MIN}
										max={CONCURRENCY_MAX}
										step={1}
										onValueChange={(value) => {
											field.onChange(value[0])
											localStorage.setItem("evals-concurrency", String(value[0]))
										}}
									/>
									<div className="w-6 text-right">{field.value}</div>
								</div>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="timeout"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Timeout (Minutes)</FormLabel>
							<FormControl>
								<div className="flex flex-row items-center gap-2">
									<Slider
										value={[field.value]}
										min={TIMEOUT_MIN}
										max={TIMEOUT_MAX}
										step={1}
										onValueChange={(value) => {
											field.onChange(value[0])
											localStorage.setItem("evals-timeout", String(value[0]))
										}}
									/>
									<div className="w-6 text-right">{field.value}</div>
								</div>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="iterations"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Iterations</FormLabel>
							<FormControl>
								<div className="flex flex-row items-center gap-2">
									<Slider
										value={[field.value]}
										min={ITERATIONS_MIN}
										max={ITERATIONS_MAX}
										step={1}
										onValueChange={(value) => {
											field.onChange(value[0])
										}}
									/>
									<div className="w-6 text-right">{field.value}</div>
								</div>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
			</div>
		</>
	)
}

export function TerminalTimeoutSection({
	commandExecutionTimeout,
	setCommandExecutionTimeout,
	terminalShellIntegrationTimeout,
	setTerminalShellIntegrationTimeout,
}: {
	commandExecutionTimeout: number
	setCommandExecutionTimeout: (value: number) => void
	terminalShellIntegrationTimeout: number
	setTerminalShellIntegrationTimeout: (value: number) => void
}) {
	return (
		<div className="grid grid-cols-2 gap-4 py-5">
			<FormItem>
				<div className="flex items-center gap-1">
					<Label>Command Timeout (Seconds)</Label>
					<Tooltip>
						<TooltipTrigger asChild>
							<Info className="size-4 text-muted-foreground cursor-help" />
						</TooltipTrigger>
						<TooltipContent side="right" className="max-w-xs">
							<p>
								Maximum time in seconds to wait for terminal command execution to complete before timing
								out.
							</p>
						</TooltipContent>
					</Tooltip>
				</div>
				<div className="flex flex-row items-center gap-2">
					<Slider
						value={[commandExecutionTimeout]}
						min={20}
						max={60}
						step={1}
						onValueChange={([value]) => {
							if (value !== undefined) {
								setCommandExecutionTimeout(value)
								localStorage.setItem("evals-command-execution-timeout", String(value))
							}
						}}
					/>
					<div className="w-8 text-right">{commandExecutionTimeout}</div>
				</div>
			</FormItem>
			<FormItem>
				<div className="flex items-center gap-1">
					<Label>Shell Integration Timeout (Seconds)</Label>
					<Tooltip>
						<TooltipTrigger asChild>
							<Info className="size-4 text-muted-foreground cursor-help" />
						</TooltipTrigger>
						<TooltipContent side="right" className="max-w-xs">
							<p>
								Maximum time in seconds to wait for shell integration to initialize when opening a new
								terminal.
							</p>
						</TooltipContent>
					</Tooltip>
				</div>
				<div className="flex flex-row items-center gap-2">
					<Slider
						value={[terminalShellIntegrationTimeout]}
						min={30}
						max={60}
						step={1}
						onValueChange={([value]) => {
							if (value !== undefined) {
								setTerminalShellIntegrationTimeout(value)
								localStorage.setItem("evals-shell-integration-timeout", String(value))
							}
						}}
					/>
					<div className="w-8 text-right">{terminalShellIntegrationTimeout}</div>
				</div>
			</FormItem>
		</div>
	)
}
