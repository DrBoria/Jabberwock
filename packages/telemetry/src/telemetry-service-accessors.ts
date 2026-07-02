import type { TelemetryClient } from "@jabberwock/types"

import { TelemetryService } from "./TelemetryService.ts"

let _globalTelemetryService: TelemetryService | null = null

export function createTelemetryService(clients: TelemetryClient[] = []): TelemetryService {
	if (_globalTelemetryService) {
		throw new Error("TelemetryService instance already created")
	}

	_globalTelemetryService = new TelemetryService(clients)
	return _globalTelemetryService
}

export function getTelemetryService(): TelemetryService {
	if (!_globalTelemetryService) {
		throw new Error("TelemetryService not initialized")
	}

	return _globalTelemetryService
}

export function hasTelemetryService(): boolean {
	return _globalTelemetryService !== null
}

export function resetTelemetryService(): void {
	_globalTelemetryService = null
}

export type { TelemetryService as TelemetryServiceType }
