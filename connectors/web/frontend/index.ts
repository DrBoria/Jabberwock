/**
 * Browser WS frontend connector public entry (plan §4.4 / §6.2 / §9.4).
 *
 * Pure re-export barrel for `BrowserWsFrontendConnector`, the browser-side host
 * adapter for standalone server mode, plus the event-bus and socket surfaces it is
 * built on.
 */
export { BrowserWsFrontendConnector } from "./connector"
export type { BrowserClientKind, BrowserWsConnectorOptions } from "./connector"
export { BrowserWsEventBus, isDomLocalMessageType } from "./event-bus"
export type { BrowserWsEventBusOptions, WindowLike } from "./event-bus"
export { openBrowserSocket } from "./socket"
export type { SocketFactory, WsSocket } from "./socket"
