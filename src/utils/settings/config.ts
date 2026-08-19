export type InjectableConfigType =
	| string
	| {
			[key: string]:
				| undefined
				| null
				| boolean
				| number
				| InjectableConfigType
				| Array<undefined | null | boolean | number | InjectableConfigType>
	  }
	| InjectableConfigType[]

/**
 * Deeply injects environment variables into a configuration object/string/json
 *
 * Uses VSCode env:name pattern: https://code.visualstudio.com/docs/reference/variables-reference#_environment-variables
 *
 * Does not mutate original object
 */
export async function injectVariables(
	config: InjectableConfigType,
	vars: { env: NodeJS.ProcessEnv; workspaceFolder: string },
): Promise<InjectableConfigType> {
	if (typeof config === "string") {
		let result = config
		// Replace ${env:VAR_NAME} with the environment variable value
		result = result.replace(/\$\{env:([^}]+)\}/g, (_, name: string) => {
			return vars.env[name] ?? ""
		})
		// Replace ${workspaceFolder} with the workspace folder path
		result = result.replace(/\$\{workspaceFolder\}/g, vars.workspaceFolder)
		return result
	}

	if (Array.isArray(config)) {
		return (await Promise.all(config.map((item) => injectVariables(item, vars)))) as InjectableConfigType
	}

	if (config !== null && typeof config === "object") {
		const result: Record<string, InjectableConfigType> = {}
		for (const [key, value] of Object.entries(config)) {
			if (value !== undefined && value !== null) {
				result[key] = await injectVariables(value as InjectableConfigType, vars)
			}
		}
		return result
	}

	return config
}
