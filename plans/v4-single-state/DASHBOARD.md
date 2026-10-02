# v4 single-state — DASHBOARD

Source of truth: [`../architecture-v4-single-state.md`](../architecture-v4-single-state.md)

Цель: ОДИН backend (vscode extension host, F5) обслуживает ВСЕХ клиентов:
vscode-webview (postMessage) + браузер (WS :3000 /ws). Standalone-сервер не трогаем.

## Слайсы

| ID  | Слайс                                                                                                                                                              | Статус |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 01  | Общий WS-протокол в `packages/ws-protocol` (core + registry + static); `WebWsServer` — тонкая обёртка; unit-тесты                                                  | DONE   |
| 02  | `VscodeWebviewBackendConnector`: WS+HTTP-слушатель (:3000, /ws, статика `frontend/build` + `config.js`), sendOutbound → webview + WS, inbound WS → dispatchInbound | DONE   |
| 03  | Cleanup dev-флоу (skills-доки: web через F5, standalone из dev убран) + финальная верификация `pnpm check-all` + `pnpm build --force`                              | DONE   |

## Детали по слайсам

### 01 — shared ws-protocol

- Новый пакет `packages/ws-protocol` (`@jabberwock/ws-protocol`): `WsServerCore`
  (hello→state handshake, envelope, ClientRegistry, broadcast/targeted sendOutbound,
  inbound dispatch, pubsub-события client.connected/disconnected), `ClientRegistry`,
  `StaticFileServer` (вынесены из `connectors/web/backend`).
- `WebWsServer` (connectors/web) — тонкая обёртка над `WsServerCore` (production
  standalone не меняется по поведению).
- Тесты: `packages/ws-protocol/src/ws-server-core.test.ts` (handshake, registry,
  broadcast, targeted, inbound, malformed frames) + `static-file-server.test.ts`.

### 02 — vscode connector WS listener

- `connectors/vscode/backend/ws-server.ts` — новый модуль: `WsBackendListener`
  (порт 3000 по умолчанию, override `JABBERWOCK_WEB_PORT`; /ws + статика
  `frontend/build` + `config.js` с `window.__JABBERWOCK_CONFIG__ = { wsUrl }`).
- `connector.ts`: `start()` поднимает listener; `sendOutbound` → webview (postMessage)
    - WS-клиенты (broadcast; targeted `client:<id>`; `client:vscode` — только webview);
      inbound WS → `dispatchInbound(clientId, body)` (тот же пайплайн, G2/G3).
- `getState` для hello — `getBackendRootSnapshot()` (relative import, как уже делает
  connector через `../../../backend/...`), с safe-fallback `{}` до инициализации root store.
- Порт занят → warn + web-слушатель отключается (extension не падает).

### 03 — cleanup + verification

- `.github/skills/run-extension/SKILL.md`, `.github/skills/smoke-test/SKILL.md`
  (и зеркала `.roo/skills/*`): web-UI теперь через F5 (`http://127.0.0.1:3000`),
  standalone `node backend/dist/server.js --serve-static` — только production/Docker.
- `pnpm check-all` + `pnpm build --force` — 0 ошибок.

## Верификация (статическая; E2E 2.1–2.7 делает главная сессия)

- [x] s01: unit-тесты ws-protocol (vitest) — pass
- [x] s02: lint + check-types + test + build --force — pass
- [x] s03: `pnpm check-all` — pass (см. отчёт)
