import type { ExtensionContext } from "vscode"

import type { CloudServiceEvents } from "@jabberwock/types"

import { CloudService } from "./service/CloudService.ts"

let _globalCloudService: CloudService | null = null

export async function createCloudService(
	context: ExtensionContext,
	log?: (...args: unknown[]) => void,
	eventHandlers?: Partial<{
		[K in keyof CloudServiceEvents]: (...args: CloudServiceEvents[K]) => void
	}>,
): Promise<CloudService> {
	if (_globalCloudService) {
		throw new Error("CloudService instance already created")
	}

	const service = new CloudService(context, log)
	await service.initialize()

	if (eventHandlers) {
		for (const [event, handler] of Object.entries(eventHandlers)) {
			if (handler) {
				service.on(
					event as keyof CloudServiceEvents,
					handler as (...args: CloudServiceEvents[keyof CloudServiceEvents]) => void,
				)
			}
		}
	}

	await service.authService?.broadcast()

	_globalCloudService = service
	return service
}

export function getCloudService(): CloudService {
	if (!_globalCloudService) {
		throw new Error("CloudService not initialized")
	}

	return _globalCloudService
}

export function hasCloudService(): boolean {
	return _globalCloudService !== null && _globalCloudService.isInitialized
}

export function resetCloudService(): void {
	if (_globalCloudService) {
		_globalCloudService.dispose()
		_globalCloudService = null
	}
}

export function isCloudEnabled(): boolean {
	return !!_globalCloudService?.isAuthenticated()
}
