// Type declarations for third-party modules

declare module "knuth-shuffle-seeded" {
	export default function knuthShuffle<T>(array: T[], seed: number | string | null | undefined): T[]
}

// ─── Window augmentation for MST bridge, DevTools, and images ──────
interface MstBridge {
	handleSnapshotBatch(batch: { snapshots: Array<{ storeName: string; snapshot: Record<string, unknown> }> }): void
	getStore<T = unknown>(id: string): T | undefined
}

declare global {
	interface Window {
		__JABBERWOCK_MST_BRIDGE__?: MstBridge
		IMAGES_BASE_URI?: string
		__JABBERWOCK_GET_STATE__?: () => Record<string, unknown>
	}
}

export {}
