import type { RootStoreSelf } from "./types"
import { createExtensionSettersPart1 } from "./setters-part1"
import { createExtensionSettersPart2 } from "./setters-part2"

export function createExtensionSetters(self: RootStoreSelf) {
	return {
		...createExtensionSettersPart1(self),
		...createExtensionSettersPart2(self),
	}
}
