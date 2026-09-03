import { config } from "@jabberwock/config-eslint/base"

/**
 * v4 Phase C1: ESLint config for the web connector package.
 *
 * The backend side is pure Node.js (no "vscode" import — that is the automatic purity
 * proof, criterion C-2 §8.3). The shared base config enforces the repo's strict type
 * hygiene and architecture rules.
 */
export default [
	...config,
	{
		ignores: ["dist/**", "frontend/build/**"],
	},
]
