/**
 * Transport envelope for the v4 connector abstraction (plan §4.1).
 *
 * The envelope is the identity wrapper added by the transport layer so that a
 * receiver can route a message to its logical sender without inspecting the
 * body. The body is intentionally kept byte-identical to the message types
 * used today (e.g. `WebviewMessage`), so the envelope never changes the
 * payload — it only adds `protocolVersion`/`clientId`/`sentAt` bookkeeping.
 *
 * Обёртка транспорта для коннектор-абстракции v4 (план §4.1). Envelope — это
 * identity-обёртка, добавляемая транспортным слоем, чтобы получатель мог
 * адресовать сообщение логическому отправителю без анализа тела. Тело намеренно
 * остаётся байт-в-байт идентичным текущим типам сообщений (например,
 * `WebviewMessage`), поэтому envelope не меняет payload — он лишь добавляет
 * служебные поля `protocolVersion`/`clientId`/`sentAt`.
 */

/**
 * Version of the v4 connector protocol. Bumped only on breaking wire changes.
 * Каждая ломающая изменение на «проводе» должна инкрементировать эту версию.
 */
export const PROTOCOL_VERSION = 1 as const

/**
 * Transport envelope for every message crossing a connector boundary.
 *
 * `TBody` is constrained to carry a discriminated `type` field so that routing
 * filters (see `MessageFilter`) can match on it cheaply.
 *
 * Конверт транспорта для каждого сообщения, пересекающего границу коннектора.
 * `TBody` ограничен наличием дискриминантного поля `type`, чтобы фильтры
 * маршрутизации (см. `MessageFilter`) могли сопоставляться по нему без
 * десериализации всего тела.
 */
export interface ConnectorEnvelope<TBody extends { type: string }> {
	/**
	 * Protocol version of this envelope. Must equal `PROTOCOL_VERSION`.
	 * Версия протокола данного конверта. Должна равняться `PROTOCOL_VERSION`.
	 */
	protocolVersion: typeof PROTOCOL_VERSION

	/**
	 * Logical id of the sending client (present on multi-client transports,
	 * e.g. the web connector's websocket). Absent/undefined on single-client
	 * transports (e.g. vscode) where routing is implicit.
	 * Логический id клиента-отправителя (есть на многоклиентских транспортах,
	 * например websocket веб-коннектора). Отсутствует на одноклиентских
	 * транспортах (например vscode), где маршрутизация неявная.
	 */
	clientId?: string

	/**
	 * Epoch milliseconds at which the sender created the envelope.
	 * Количество миллисекунд с эпохи, когда отправитель создал конверт.
	 */
	sentAt: number

	/**
	 * The actual message payload, unchanged from today's message types.
	 * Сам payload сообщения, без изменений относительно текущих типов сообщений.
	 */
	body: TBody
}

/**
 * Strictly parses an unknown value into an envelope body + optional clientId.
 *
 * Throws on:
 * - non-object / null input,
 * - missing or foreign `protocolVersion` (i.e. `!== PROTOCOL_VERSION`),
 * - a body that is not a non-null object.
 *
 * Parsing is strict by design: a foreign or malformed envelope must fail fast
 * rather than be silently misrouted (§4.1).
 *
 * Строго разбирает неизвестное значение в тело конверта + необязательный
 * `clientId`. Бросает исключение при:
 * - не-объекте / null на входе,
 * - отсутствующем или чужом `protocolVersion` (т.е. `!== PROTOCOL_VERSION`),
 * - теле, не являющемся не-null объектом.
 *
 * Разбор намеренно строгий: чужой или битый конверт должен упасть быстро,
 * а не быть молча переадресован не туда (§4.1).
 */
export function unwrapEnvelope<T>(raw: unknown): { clientId?: string; body: T } {
	if (raw === null || typeof raw !== 'object') {
		throw new Error('ConnectorEnvelope: expected an object, got ' + typeof raw)
	}

	const candidate = raw as { protocolVersion?: unknown; clientId?: unknown; body?: unknown }

	if (candidate.protocolVersion !== PROTOCOL_VERSION) {
		throw new Error(
			`ConnectorEnvelope: unsupported protocolVersion ${String(candidate.protocolVersion)} ` +
				`(expected ${String(PROTOCOL_VERSION)})`
		)
	}

	if (candidate.body === null || typeof candidate.body !== 'object') {
		throw new Error('ConnectorEnvelope: expected a body object')
	}

	const { clientId, body } = candidate as { clientId?: string; body: T }
	return { clientId, body }
}
