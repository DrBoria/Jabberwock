// v4 B4 (plan §7.2/§10.2 L2): VSIX entry for the VSCode extension host.
// The bundled output is backend/dist/extension.js (manifest `main` field stays in
// backend/package.json — R7). The activation tree lives under ./activation
// (was backend/extension.ts + backend/activate/**, moved at B4).
export { activate, deactivate } from "./activation/extension"
