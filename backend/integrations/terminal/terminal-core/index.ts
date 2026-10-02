// D4g-2 (batch 4): Terminal and TerminalProcess moved to the vscode connector
// (connectors/vscode/backend/integrations/terminal/terminal-core/). Only the
// vscode-free base classes + config remain in the shared backend.
export { TerminalConfig } from "./config"
export { BaseTerminal } from "./main"
export { BaseTerminalProcess } from "./process"
