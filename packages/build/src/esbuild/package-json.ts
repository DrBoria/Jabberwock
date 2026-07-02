import { ViewsContainer, Views, Menus, Configuration, Keybindings, contributesSchema } from "../types.js"

export function generatePackageJson({
	packageJson: { contributes, ...packageJson },
	overrideJson,
	substitution,
}: {
	packageJson: Record<string, unknown>
	overrideJson: Record<string, unknown>
	substitution: [string, string]
}) {
	const { viewsContainers, views, commands, menus, submenus, keybindings, configuration } =
		contributesSchema.parse(contributes)
	const [from, to] = substitution

	const contributesObj: Record<string, unknown> = {
		viewsContainers: transformArrayRecord<ViewsContainer>(viewsContainers, from, to, ["id"]),
		views: transformArrayRecord<Views>(views, from, to, ["id"]),
		commands: transformArray(commands, from, to, "command"),
		menus: transformArrayRecord<Menus>(menus, from, to, ["command", "submenu", "when"]),
		submenus: transformArray(submenus, from, to, "id"),
		configuration: {
			title: configuration.title,
			properties: transformRecord<Configuration["properties"]>(configuration.properties, from, to),
		},
	}

	// Only add keybindings if they exist
	if (keybindings) {
		contributesObj.keybindings = transformArray<Keybindings>(keybindings, from, to, "command")
	}

	const result: Record<string, unknown> = {
		...packageJson,
		...overrideJson,
		contributes: contributesObj,
	}

	return result
}

function transformArrayRecord<T>(
	obj: Record<string, Record<string, unknown>[]>,
	from: string,
	to: string,
	props: string[],
): T {
	return Object.entries(obj).reduce(
		(acc, [key, ary]) => ({
			...acc,
			[key.replaceAll(from, to)]: ary.map((item) => {
				const transformedItem = { ...item }

				for (const prop of props) {
					if (prop in item && typeof item[prop] === "string") {
						transformedItem[prop] = item[prop].replaceAll(from, to)
					}
				}

				return transformedItem
			}),
		}),
		{} as T,
	)
}

function transformArray<T>(arr: Record<string, unknown>[], from: string, to: string, idProp: string): T[] {
	return arr.map((item) => {
		const id = item[idProp] as string
		const { [idProp]: _unused, ...rest } = item
		return {
			[idProp]: id.replaceAll(from, to),
			...rest,
		} as T
	})
}

function transformRecord<T>(obj: Record<string, unknown>, from: string, to: string): T {
	return Object.entries(obj).reduce(
		(acc, [key, value]) => ({
			...acc,
			[key.replaceAll(from, to)]: value,
		}),
		{} as T,
	)
}
