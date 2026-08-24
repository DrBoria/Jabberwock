export { RootStore } from "./store"
export type { IRootStore } from "./store"
export {
	createRootStore,
	getRootStore,
	getFrontendActionBuffer,
	disposeIntentBus,
	rootStore,
} from "./bootstrap/singleton"
