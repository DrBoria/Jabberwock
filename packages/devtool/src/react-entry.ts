/**
 * Browser-safe entry point for the @jabberwock/devtool package.
 *
 * This entry point only exports components that work in the browser/webview
 * context (no Node.js dependencies like `fs` or `ws`).
 *
 * Usage in webview-ui:
 *   import { DevtoolProvider } from "@jabberwock/devtool/react"
 */
export { DevtoolProvider } from "./react/DevtoolProvider.js"
export type { DevtoolProviderProps } from "./react/DevtoolProvider.js"
