import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { convertTheme, IVSCodeTheme } from "monaco-vscode-textmate-theme-converter/lib/cjs"

import { Package } from "@shared/package"

const defaultThemes: Record<string, string> = {
	"Default Dark Modern": "dark_modern",
	"Dark+": "dark_plus",
	"Default Dark+": "dark_plus",
	"Dark (Visual Studio)": "dark_vs",
	"Visual Studio Dark": "dark_vs",
	"Dark High Contrast": "hc_black",
	"Default High Contrast": "hc_black",
	"Light High Contrast": "hc_light",
	"Default High Contrast Light": "hc_light",
	"Default Light Modern": "light_modern",
	"Light+": "light_plus",
	"Default Light+": "light_plus",
	"Light (Visual Studio)": "light_vs",
	"Visual Studio Light": "light_vs",
}

function parseThemeString(themeString: string | undefined): Record<string, unknown> {
	themeString = themeString
		?.split("\n")
		.filter((line) => {
			return !line.trim().startsWith("//")
		})
		.join("\n")
	return JSON.parse(themeString ?? "{}")
}

async function findThemeInExtensions(colorTheme: string): Promise<string | undefined> {
	for (let i = vscode.extensions.all.length - 1; i >= 0; i--) {
		const extension = vscode.extensions.all[i]
		if (extension.packageJSON?.contributes?.themes?.length > 0) {
			for (const theme of extension.packageJSON.contributes.themes) {
				if (theme.label === colorTheme) {
					const themePath = path.join(extension.extensionPath, theme.path)
					return fs.readFile(themePath, "utf-8")
				}
			}
		}
	}
	return undefined
}

function loadDefaultThemeFile(colorTheme: string): Promise<string> | undefined {
	const themeKey = defaultThemes[colorTheme]
	if (!themeKey) {
		return undefined
	}
	const filename = `${themeKey}.json`
	return fs.readFile(
		path.join(getExtensionUri().fsPath, "integrations", "theme", "default-themes", filename),
		"utf-8",
	)
}

async function resolveIncludedTheme(parsed: Record<string, unknown>): Promise<Record<string, unknown>> {
	const includePath = parsed.include
	if (!includePath) {
		return parsed
	}
	const includeThemeString = await fs.readFile(
		path.join(getExtensionUri().fsPath, "integrations", "theme", "default-themes", includePath as string),
		"utf-8",
	)
	const includeTheme = parseThemeString(includeThemeString)
	return mergeJson(parsed, includeTheme)
}

function determineBaseTheme(
	converted: IVSCodeTheme & Record<string, unknown>,
	colorTheme: string,
): vscode.ColorThemeKind {
	if (["vs", "hc-black"].includes(converted.base as string)) {
		return converted.base as vscode.ColorThemeKind
	}
	return colorTheme.includes("Light") ? vscode.ColorThemeKind.Light : vscode.ColorThemeKind.Dark
}

export async function getTheme() {
	const colorTheme = vscode.workspace.getConfiguration("workbench").get<string>("colorTheme") || "Default Dark Modern"

	try {
		let currentTheme = await findThemeInExtensions(colorTheme)

		if (currentTheme === undefined) {
			currentTheme = await loadDefaultThemeFile(colorTheme)
		}

		let parsed = parseThemeString(currentTheme)
		parsed = await resolveIncludedTheme(parsed)

		const converted = convertTheme(parsed as IVSCodeTheme & Record<string, unknown>)
		converted.base = determineBaseTheme(converted, colorTheme)

		return converted
	} catch (e) {
		console.log("Error loading color theme: ", e)
	}
	return undefined
}

function mergeArrays(
	firstValue: unknown[],
	secondValue: unknown[],
	key: string,
	mergeKeys?: { [key: string]: (a: unknown, b: unknown) => boolean },
): unknown[] {
	if (!mergeKeys?.[key]) {
		return [...firstValue, ...secondValue]
	}
	const keptFromFirst = firstValue.filter(
		(item) => !secondValue.some((item2: unknown) => mergeKeys[key](item, item2)),
	)
	return [...keptFromFirst, ...secondValue]
}

type JsonObject = { [key: string]: unknown }
export function mergeJson(
	first: JsonObject,
	second: JsonObject,
	mergeBehavior?: "merge" | "overwrite",
	mergeKeys?: { [key: string]: (a: unknown, b: unknown) => boolean },
): JsonObject {
	const copyOfFirst = JSON.parse(JSON.stringify(first))

	try {
		for (const key in second) {
			const secondValue = second[key]

			if (!(key in copyOfFirst) || mergeBehavior === "overwrite") {
				copyOfFirst[key] = secondValue
				continue
			}

			const firstValue = copyOfFirst[key]
			if (Array.isArray(secondValue) && Array.isArray(firstValue)) {
				copyOfFirst[key] = mergeArrays(firstValue, secondValue, key, mergeKeys)
			} else if (typeof secondValue === "object" && typeof firstValue === "object") {
				copyOfFirst[key] = mergeJson(firstValue as JsonObject, secondValue as JsonObject, mergeBehavior)
			} else {
				copyOfFirst[key] = secondValue
			}
		}
		return copyOfFirst
	} catch (e) {
		console.error("[jabberwock] Error merging JSON", e, copyOfFirst, second)
		return {
			...copyOfFirst,
			...second,
		}
	}
}

function getExtensionUri(): vscode.Uri {
	return vscode.extensions.getExtension(`${Package.publisher}.${Package.name}`)!.extensionUri
}
