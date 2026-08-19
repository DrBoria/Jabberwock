"use client"

import { useRouter } from "next/navigation"
import { Rocket, X, Info, MonitorPlay, Terminal } from "lucide-react"

import {
	Button,
	FormField,
	FormItem,
	FormLabel,
	FormControl,
	FormMessage,
	Input,
	Textarea,
	Tabs,
	TabsList,
	TabsTrigger,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui"

import type { ExecutionMethod } from "@/lib/schemas"
import type { UseFormReturn } from "react-hook-form"
import type { CreateRun } from "@/lib/schemas"

export function CloudTokenSection({ form }: { form: UseFormReturn<CreateRun> }) {
	return (
		<FormField
			control={form.control}
			name="jobToken"
			render={({ field }) => (
				<FormItem>
					<div className="flex items-center gap-1">
						<FormLabel>Jabberwock Cloud Token</FormLabel>
						<Tooltip>
							<TooltipTrigger asChild>
								<Info className="size-4 text-muted-foreground cursor-help" />
							</TooltipTrigger>
							<TooltipContent side="right" className="max-w-xs">
								<p>Generate a token with:</p>
								<code className="text-xs block mt-1">
									pnpm --filter @jabberwock-cloud/auth production:create-auth-token [email] [org]
									[ttl]
								</code>
							</TooltipContent>
						</Tooltip>
					</div>
					<FormControl>
						<Input type="password" placeholder="Required" {...field} />
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>
	)
}

export function ExecutionMethodSection({
	executionMethod,
	setExecutionMethod,
	form,
}: {
	executionMethod: ExecutionMethod
	setExecutionMethod: (v: ExecutionMethod) => void
	form: UseFormReturn<CreateRun>
}) {
	return (
		<FormField
			control={form.control}
			name="executionMethod"
			render={() => (
				<FormItem>
					<FormLabel>Execution Method</FormLabel>
					<Tabs
						value={executionMethod}
						onValueChange={(value) => {
							setExecutionMethod(value as ExecutionMethod)
							form.setValue("executionMethod", value as ExecutionMethod)
						}}>
						<TabsList>
							<TabsTrigger value="vscode" className="flex items-center gap-2">
								<MonitorPlay className="size-4" />
								VSCode
							</TabsTrigger>
							<TabsTrigger value="cli" className="flex items-center gap-2">
								<Terminal className="size-4" />
								CLI
							</TabsTrigger>
						</TabsList>
					</Tabs>
					<FormMessage />
				</FormItem>
			)}
		/>
	)
}

export function DescriptionSection({ form }: { form: UseFormReturn<CreateRun> }) {
	return (
		<FormField
			control={form.control}
			name="description"
			render={({ field }) => (
				<FormItem>
					<FormLabel>Description / Notes</FormLabel>
					<FormControl>
						<Textarea placeholder="Optional" {...field} />
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>
	)
}

export function SubmitButton({ isSubmitting }: { isSubmitting: boolean }) {
	return (
		<div className="flex justify-end">
			<Button size="lg" type="submit" disabled={isSubmitting}>
				<Rocket className="size-4" />
				Launch
			</Button>
		</div>
	)
}

export function CloseButton() {
	const router = useRouter()
	return (
		<Button
			variant="default"
			className="absolute top-4 right-12 size-12 rounded-full"
			onClick={() => router.push("/")}>
			<X className="size-6" />
		</Button>
	)
}
