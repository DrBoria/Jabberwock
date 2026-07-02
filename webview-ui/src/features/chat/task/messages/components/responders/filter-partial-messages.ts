import type { Notification } from "@jabberwock/types"

export function filterPartialMessages(msgs: Notification[], isActive: boolean): Notification[] {
	return isActive ? msgs.filter((msg) => !(msg as Notification & { partial?: boolean }).partial) : msgs
}
