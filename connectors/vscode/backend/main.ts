// v4 C2 (plan §7.2/§10.2 L2): thin adapter over the shared backend bootstrap.
// VSIX entry for the VSCode extension host: builds the VscodeWebviewBackendConnector +
// capabilities from the vscode context and calls `startBackend()` (§7.1); the vscode-specific
// activation layer (registerCommands, code actions, URI handler, IpcServer) stays on top of
// the common core in ./activation/extension.
// The bundled output is backend/dist/extension.js (manifest `main` field stays in
// backend/package.json — R7).
export { activate, deactivate } from "./activation/extension"
