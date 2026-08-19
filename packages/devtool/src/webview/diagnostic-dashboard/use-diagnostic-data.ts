import { useMemo } from "react"
import type { DiagnosticSnapshot } from "@jabberwock/types"

export function useDiagnosticData(diagnostics: DiagnosticSnapshot | undefined) {
	const logs = diagnostics?.logs ?? []
	const metrics = diagnostics?.metrics ?? []
	const resources = diagnostics?.resources ?? []
	const currentAction = diagnostics?.currentAction
	const lastResource = resources[resources.length - 1]

	const memoryPercent = useMemo(() => {
		if (!lastResource) return 0
		return (lastResource.memoryUsage.heapUsed / lastResource.memoryUsage.heapTotal) * 100
	}, [lastResource])

	return { logs, metrics, resources, currentAction, lastResource, memoryPercent }
}
