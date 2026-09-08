/**
 * Frontend connector-bus public entry (plan §4.5, §7.3).
 *
 * Pure re-export barrel — the implementation lives in `./connector-bus` so this
 * index file satisfies the `local/no-logic-in-index` lint rule.
 */
export {
	createFrontendConnector,
	initConnectorBus,
	getConnectorBus,
	ConnectorBusContext,
	useConnectorBus,
	isWebMode,
	__resetConnectorBusForTests,
} from "./connector-bus"
export type { FrontendEnv } from "./connector-bus"
