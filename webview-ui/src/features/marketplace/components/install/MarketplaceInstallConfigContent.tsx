import React from "react"
import type { McpParameter } from "@jabberwock/types"
import { Input } from "@src/shared/ui/inputs/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/shared/ui/selects/select"

interface InstallConfigProps {
	scope: "project" | "global"
	setScope: (s: "project" | "global") => void
	hasWorkspace: boolean
	hasMultipleMethods: boolean
	selectedMethodIndex: number
	setSelectedMethodIndex: (i: number) => void
	methodNames: string[]
	effectivePrerequisites: string[]
	effectiveParameters: McpParameter[]
	parameterValues: Record<string, string>
	setParameterValues: React.Dispatch<React.SetStateAction<Record<string, string>>>
	validationError: string | null
	t: (key: string, options?: Record<string, unknown>) => string
}

export const InstallConfigContent: React.FC<InstallConfigProps> = ({
	scope,
	setScope,
	hasWorkspace,
	hasMultipleMethods,
	selectedMethodIndex,
	setSelectedMethodIndex,
	methodNames,
	effectivePrerequisites,
	effectiveParameters,
	parameterValues,
	setParameterValues,
	validationError,
	t,
}) => (
	<div className="space-y-4 py-2">
		<div className="space-y-2">
			<div className="text-base font-semibold">{t("marketplace:install.scope")}</div>
			<div className="space-y-2">
				<label className="flex items-center space-x-2">
					<input
						type="radio"
						name="scope"
						value="project"
						checked={scope === "project"}
						onChange={() => setScope("project")}
						disabled={!hasWorkspace}
						className="rounded-full"
					/>
					<span className={!hasWorkspace ? "opacity-50" : ""}>{t("marketplace:install.project")}</span>
				</label>
				<label className="flex items-center space-x-2">
					<input
						type="radio"
						name="scope"
						value="global"
						checked={scope === "global"}
						onChange={() => setScope("global")}
						className="rounded-full"
					/>
					<span>{t("marketplace:install.global")}</span>
				</label>
			</div>
		</div>
		{hasMultipleMethods && (
			<div className="space-y-2">
				<div className="text-base font-semibold">{t("marketplace:install.method")}</div>
				<Select
					value={String(selectedMethodIndex)}
					onValueChange={(value) => setSelectedMethodIndex(Number(value))}>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{methodNames.map((name, index) => (
							<SelectItem key={index} value={String(index)}>
								{name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		)}
		{effectivePrerequisites.length > 0 && (
			<div className="space-y-2">
				<div className="text-base font-semibold">{t("marketplace:install.prerequisites")}</div>
				<ul className="list-disc list-inside space-y-1 text-sm">
					{effectivePrerequisites.map((prereq, index) => (
						<li key={index} className="text-muted-foreground">
							{prereq}
						</li>
					))}
				</ul>
			</div>
		)}
		{effectiveParameters.length > 0 && (
			<div className="space-y-3">
				<div className="space-y-1">
					<div className="text-base font-semibold">{t("marketplace:install.configuration")}</div>
					<div className="text-sm text-muted-foreground">
						{t("marketplace:install.configurationDescription")}
					</div>
				</div>
				{effectiveParameters.map((param) => (
					<div key={param.key} className="space-y-1">
						<label htmlFor={param.key} className="text-sm">
							{param.name}
							{param.optional ? " (optional)" : ""}
						</label>
						<Input
							id={param.key}
							type="text"
							placeholder={param.placeholder}
							value={parameterValues[param.key] || ""}
							onChange={(e) => setParameterValues((prev) => ({ ...prev, [param.key]: e.target.value }))}
						/>
					</div>
				))}
			</div>
		)}
		{validationError && (
			<div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded p-2">
				{validationError}
			</div>
		)}
	</div>
)
