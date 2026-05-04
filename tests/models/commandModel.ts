/**
 * Command Model — VS Code command discovery and execution.
 *
 * All commands are executed via extension host (vscode.commands.executeCommand) via the bridge —
 * NO interceptor usage and NO acquireVsCodeApi in eval context.
 *
 * Commands are dynamically discovered from the extension's package.json
 * `contributes.commands` section. The CommandRegistry maps short names
 * (e.g., "historyButtonClicked") to full command IDs (e.g., "jabberwock.historyButtonClicked").
 */

import type { DevtoolClient } from "../../packages/devtool/src/client"
import { CommandRegistry } from "../../packages/devtool/src/command-registry"
import type { ExtensionCommand } from "../../packages/devtool/src/command-registry"
import { DomModel } from "./domModel"

export class CommandModel {
	private registry: CommandRegistry

	/**
	 * Dynamic command runner — automatically populated from package.json.
	 *
	 * Allows calling any VS Code command by its short name:
	 *   await cmds.historyButtonClicked()
	 *   await cmds.settingsButtonClicked()
	 *   await cmds.plusButtonClicked()
	 */
	public readonly commands: Record<string, (...args: unknown[]) => Promise<void>>

	constructor(
		public readonly client: DevtoolClient,
		dom?: DomModel,
		packageJsonPath?: string,
	) {
		this.client = client
		this.registry = new CommandRegistry()
		this.registry.load(packageJsonPath)

		// Build the dynamic commands Proxy
		const registry = this.registry
		const _client = this.client
		this.commands = new Proxy(
			{},
			{
				get(_target, prop: string) {
					if (prop === "then" || prop === "toJSON" || typeof prop === "symbol") {
						return undefined
					}
					return async (...args: unknown[]) => {
						const cmdId = registry.resolveId(prop)
						if (!cmdId) {
							const available = registry.getCommandNames().join(", ")
							throw new Error(
								`Unknown command: "${prop}". ` +
									`Use a short name like "historyButtonClicked" or full ID. ` +
									`Available: ${available}`,
							)
						}
						console.log(`  [Cmd] ${cmdId}${args.length > 0 ? ` (args: ${JSON.stringify(args)})` : ""}`)
						await _client.executeVscodeCommand(cmdId, args.length > 0 ? args : undefined)
					}
				},
			},
		) as Record<string, (...args: unknown[]) => Promise<void>>
	}

	/**
	 * Get all available command names discovered from package.json.
	 */
	getCommandNames(): string[] {
		return this.registry.getCommandNames()
	}

	/**
	 * Get all available command descriptors (ID, name, title).
	 */
	getAvailableCommands(): ExtensionCommand[] {
		return this.registry.getAll()
	}

	/**
	 * Execute a VS Code command by its short name or full ID.
	 *
	 * This is the explicit alternative to the dynamic Proxy:
	 *   await cmd.executeCommand("historyButtonClicked")
	 *   await cmd.executeCommand("jabberwock.historyButtonClicked")
	 *
	 * Uses the extension host's vscode.commands.executeCommand() via the bridge.
	 *
	 * @param idOrName - Short name or full command ID
	 * @param args - Optional arguments
	 */
	async executeCommand(idOrName: string, ...args: unknown[]): Promise<void> {
		const cmdId = this.registry.resolveId(idOrName)
		if (!cmdId) {
			const available = this.registry.getCommandNames().join(", ")
			throw new Error(`Unknown command: "${idOrName}". Available: ${available}`)
		}
		console.log(`  [Cmd] ${cmdId}`)
		await this.client.executeVscodeCommand(cmdId, args.length > 0 ? args : undefined)
	}
}
