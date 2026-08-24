/**
 * Frontend-side connector contract for the v4 connector abstraction (plan §4.4–§4.5).
 *
 * The frontend connector adapts the host transport into an in-app event bus
 * (`IConnectorEventBus`) that the app-level frontend code consumes. The app never
 * sees the raw transport — it only publishes `WebviewMessage`s and subscribes to
 * inbound messages via `MessageFilter`s.
 *
 * Фронтенд-контракт коннектора для коннектор-абстракции v4 (план §4.4–§4.5).
 * Frontend-коннектор адаптирует host-транспорт во внутри-прикладную шину событий
 * (`IConnectorEventBus`), которую потребляет app-level фронтенд-код. Приложение
 * никогда не видит сырой транспорт — оно лишь публикует `WebviewMessage` и
 * подписывается на входящие сообщения через `MessageFilter`.
 */

import type { WebviewMessage } from '../webview/message.ts'
import type { ExtensionMessage } from '../extension/message.ts'
import type { ConnectorId, DisposableLike } from './backend-connector.ts'

/**
 * A message the app-level frontend can receive from the host / transport.
 *
 * This is the union of the app-inbound (host→webview) traffic class B of §2.4
 * plus the DOM-local traffic that never leaves the webview (§4.5). It is built
 * from existing `@jabberwock/types` message types: `ExtensionMessage` is the
 * current barrel-exported host→webview direction. The trailing catch-all member
 * mirrors the concrete outbound union used in the backend today
 * (`WebviewOutboundMessage`, whose last member is exactly this catch-all), so
 * unknown/forward-compatible messages remain representable.
 *
 * Сообщение, которое app-level фронтенд может получить от host / транспорта.
 *
 * Это объединение входящего в приложение (host→webview) класса трафика B из §2.4
 * плюс DOM-local трафик, который никогда не покидает webview (§4.5). Построено из
 * существующих типов сообщений `@jabberwock/types`: `ExtensionMessage` — текущее
 * barrel-экспортируемое направление host→webview. Замыкающий catch-all член
 * повторяет конкретное исходящее объединение, используемое сегодня в бэкенде
 * (`WebviewOutboundMessage`, последним членом которого является ровно этот
 * catch-all), поэтому неизвестные/forward-совместимые сообщения остаются
 * представимыми.
 */
export type InboundAppMessage = ExtensionMessage | { type: string; [key: string]: unknown }

/**
 * Filter used by `IConnectorEventBus.subscribe` to select which messages a
 * handler receives. Either a list of `type` discriminators (cheap match on the
 * envelope/body `type` field) or a full predicate.
 *
 * Фильтр, используемый `IConnectorEventBus.subscribe` для выбора сообщений,
 * получаемых обработчиком. Либо список дискриминаторов `type` (дешёвое
 * сопоставление по полю `type` конверта/тела), либо полноценный предикат.
 */
export type MessageFilter =
	| { types?: string[] }
	| ((msg: InboundAppMessage) => boolean)

/**
 * Frontend-side connector contract (plan §4.4).
 *
 * Контракт фронтенд-коннектора (план §4.4).
 */
export interface IFrontendConnector {
	readonly id: ConnectorId

	connect(opts?: Record<string, unknown>): Promise<void>
	disconnect(): void

	/**
	 * In-app event bus through which the app publishes outbound messages and
	 * subscribes to inbound ones. Never `undefined` after `connect()` resolves.
	 * Внутри-прикладная шина событий, через которую приложение публикует
	 * исходящие сообщения и подписывается на входящие. Никогда не `undefined`
	 * после того как `connect()` завершился успешно.
	 */
	readonly eventBus: IConnectorEventBus
}

/**
 * In-app event bus that decouples the app-level frontend from the raw host
 * transport (plan §4.5).
 *
 * Внутри-прикладная шина событий, отделяющая app-level фронтенд от сырого
 * host-транспорта (план §4.5).
 */
export interface IConnectorEventBus {
	/**
	 * Publishes a message to the host (outbound direction, e.g. webview→backend).
	 * Публикует сообщение в host (исходящее направление, например webview→backend).
	 */
	publish(message: WebviewMessage): void

	/**
	 * Subscribes a handler to inbound messages matching `filter`. Returns a
	 * disposable that removes the subscription when disposed.
	 * Подписывает обработчик на входящие сообщения, соответствующие `filter`.
	 * Возвращает disposable, удаляющий подписку при освобождении.
	 */
	subscribe(filter: MessageFilter, handler: (msg: InboundAppMessage) => void): DisposableLike
}
