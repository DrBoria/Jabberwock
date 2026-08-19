import fs from "fs"
import path from "path"

import type { CustomToolDefinition } from "@jabberwock/types"

export function pushNameError(name: unknown, errors: string[]): void {
	if (typeof name !== "string") {
		errors.push("name: Expected string")
	} else if (name.length === 0) {
		errors.push("name: Tool must have a non-empty name")
	}
}

export function pushDescriptionError(description: unknown, errors: string[]): void {
	if (typeof description !== "string") {
		errors.push("description: Expected string")
	} else if (description.length === 0) {
		errors.push("description: Tool must have a non-empty description")
	}
}

export function isParametersSchema(value: unknown): value is import("@jabberwock/types").CustomToolParametersSchema {
	return (
		value !== null &&
		typeof value === "object" &&
		"_def" in value &&
		typeof (value as Record<string, unknown>)._def === "object"
	)
}

export function validateToolDefinition(exportName: string, value: unknown): CustomToolDefinition | null {
	if (!value || typeof value !== "object") {
		return null
	}

	if (!("execute" in value) || typeof (value as Record<string, unknown>).execute !== "function") {
		return null
	}

	const obj = value as Record<string, unknown>
	const errors: string[] = []

	pushNameError(obj.name, errors)
	pushDescriptionError(obj.description, errors)

	if (obj.parameters !== undefined && !isParametersSchema(obj.parameters)) {
		errors.push("parameters: parameters must be a Zod schema")
	}

	if (errors.length > 0) {
		throw new Error(`Invalid tool definition for '${exportName}': ${errors.join(", ")}`)
	}

	return value as CustomToolDefinition
}

export function copyEnvFilesFn(toolDir: string, destDir: string): void {
	try {
		const files = fs.readdirSync(toolDir)
		const envFiles = files.filter((f) => f === ".env" || f.startsWith(".env."))

		for (const envFile of envFiles) {
			const srcPath = path.join(toolDir, envFile)
			const destPath = path.join(destDir, envFile)

			const stat = fs.statSync(srcPath)
			if (stat.isFile()) {
				fs.copyFileSync(srcPath, destPath)
				console.log(`[CustomToolRegistry] copied ${envFile} to tool cache directory`)
			}
		}
	} catch (error) {
		console.warn(
			`[CustomToolRegistry] failed to copy .env files: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}
