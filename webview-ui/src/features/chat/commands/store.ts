import { types, Instance } from "mobx-state-tree"

/**
 * CommandsStore — tracks available slash commands.
 * Receives snapshots from the extension-side CommandsStore via MstBridge.
 */
export const CommandsStore = types
	.model("CommandsStore", {
		commands: types.optional(types.array(types.frozen<any>()), []),
	})
	.actions((self) => ({
		setCommands(commands: any[]) {
			self.commands.replace(commands)
		},
	}))

export type ICommandsStore = Instance<typeof CommandsStore>
export const commandsStore = CommandsStore.create({})
