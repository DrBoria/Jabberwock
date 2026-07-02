import fs from "fs"
import path from "path"
import { createRequire } from "module"

import { createVSCodeAPI } from "@jabberwock/vscode-shim"

export function findCliPackageRoot(__dirname: string): string {
	let dir = __dirname
	while (dir !== path.dirname(dir)) {
		if (fs.existsSync(path.join(dir, "package.json"))) {
			return dir
		}
		dir = path.dirname(dir)
	}
	return path.resolve(__dirname, "..")
}

export function setupVSCodeModuleMock(
	extensionPath: string,
	workspacePath: string,
	cliPackageRoot: string,
	ephemeralStorageDir?: string,
): { vscode: ReturnType<typeof createVSCodeAPI>; restore: () => void; require: ReturnType<typeof createRequire> } {
	const vscode = createVSCodeAPI(extensionPath, workspacePath, undefined, {
		appRoot: cliPackageRoot,
		storageDir: ephemeralStorageDir,
	})
	;(global as Record<string, unknown>).vscode = vscode
	;(global as Record<string, unknown>).__extensionHost = null as unknown as Record<string, unknown>
	const require = createRequire(import.meta.url)
	const Module = require("module")
	const originalResolve = Module._resolveFilename
	Module._resolveFilename = function (request: string, parent: unknown, isMain: boolean, options: unknown) {
		if (request === "vscode") return "vscode-mock"
		return originalResolve.call(this, request, parent, isMain, options)
	}
	require.cache["vscode-mock"] = {
		id: "vscode-mock",
		filename: "vscode-mock",
		loaded: true,
		exports: vscode,
		children: [],
		paths: [],
		path: "",
		isPreloading: false,
		parent: null,
		require: require,
	} as NodeJS.Module
	return {
		vscode,
		require,
		restore: () => {
			Module._resolveFilename = originalResolve
		},
	}
}

export async function loadExtensionModule(
	bundlePath: string,
	requireObj: ReturnType<typeof createRequire>,
): Promise<unknown> {
	return requireObj(bundlePath) as { activate: (context: unknown) => Promise<unknown> }
}

export async function cleanupEphemeralStorage(dir: string | null): Promise<void> {
	if (!dir) return
	try {
		await fs.promises.rm(dir, { recursive: true, force: true })
	} catch {
		/* noop */
	}
}

export function resetCliRuntimeEnv(previousValue: string | undefined): void {
	if (previousValue === undefined) {
		delete process.env.JABBERWOCK_CLI_RUNTIME
	} else {
		process.env.JABBERWOCK_CLI_RUNTIME = previousValue
	}
}
