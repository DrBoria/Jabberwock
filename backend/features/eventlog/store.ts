import { types, Instance } from "mobx-state-tree"

export const EventLogModel = types.model("EventLog", {
	type: types.string,
	ts: types.number,
	direction: types.enumeration(["outgoing", "incoming"]),
	payload: types.frozen(),
})

export type IEventLog = Instance<typeof EventLogModel>
