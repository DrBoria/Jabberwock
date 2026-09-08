# Phase D — Class B (DOM-local) Allowlist Freeze

**Status:** FROZEN (D0 — prerequisite for all Phase D code)
**Source of truth:** [`plans/architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:113) §2.4 class B file list (line 113) + §2.4 class B row (line 107) + §8.3 criterion C-3 (lines 687–695).
**Purpose:** Freeze the set of DOM-local files that legitimately keep direct DOM/`window` access and are therefore **EXEMPT** from the C-3 gate ("zero `window.addEventListener("message")` / raw host postMessage / devtool-webview wrapper import in `frontend/src/**` outside bootstrap/connector-bus"). This allowlist MUST exist BEFORE any Phase D code lands (C-3 precondition).

## Classification rule (from §2.4)

Class B traffic is **DOM-local**: UI ↔ UI within one document / iframe tree (`{type:"action"}`, `{type:"pushWindow"}`, MCP iframe `mcp-force-accept`, visibility messages, devtool store queries). It is standard Web API, identical in the vscode webview and a browser, and is **NOT part of the connector contract**. Class B files are not migrated onto `IConnectorEventBus` in Phase D; they stay as-is. Only class A (host-transport) sites are migrated.

## Allowlist — Class B files (DOM-local, exempt from C-3)

The list below is derived verbatim from §2.4 line 113. Each entry carries a one-line justification for why it keeps direct DOM/window access.

| #   | File / component (from §2.4 line 113)                                  | Justification (DOM-local, exempt)                                     |
| --- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | `select-dropdown`                                                      | Native select dropdown UI; local DOM events only, never reaches host. |
| 2   | `misc-say`                                                             | Renders say-type messages; local UI state, no host transport.         |
| 3   | `execution-error`                                                      | Local error display; DOM-local only.                                  |
| 4   | `too-many-tools-warning`                                               | Local tool-limit warning UI (`settingsButtonClicked` `*`); DOM-local. |
| 5   | `message-area`                                                         | Emits/consumes `{type:"pushWindow"}` between panels; DOM-local.       |
| 6   | `checkpoint warning`                                                   | Local checkpoint warning banner; DOM-local.                           |
| 7   | `TelemetryBanner`                                                      | Local banner UI; DOM-local.                                           |
| 8   | `SkillsSettings`                                                       | Settings sub-panel postMessage; DOM-local navigation.                 |
| 9   | `header-section`                                                       | Settings header postMessage; DOM-local navigation.                    |
| 10  | `ModeSelectorContent`                                                  | Mode selector postMessage; DOM-local.                                 |
| 11  | `McpView`                                                              | MCP settings view postMessage; DOM-local.                             |
| 12  | `McpIframeRenderer.tsx`                                                | MCP iframe host; `mcp-force-accept` DOM-local iframe traffic.         |
| 13  | chat-received iframe (`mcp-force-accept`)                              | MCP iframe accept flow; DOM-local iframe traffic.                     |
| 14  | `worktree-selector`                                                    | Local worktree selector listener; DOM-local.                          |
| 15  | `share-button`                                                         | Local share button listener; DOM-local.                               |
| 16  | `useMessageHandlers` (dndTextArea)                                     | Drag-and-drop text area message handlers; DOM-local.                  |
| 17  | `file-changes-panel`                                                   | Local file-changes panel listener; DOM-local.                         |
| 18  | `feedback-say`                                                         | Local feedback say listener; DOM-local.                               |
| 19  | `useRowDisplay`                                                        | Local row-display hook listener; DOM-local.                           |
| 20  | `content.tsx`                                                          | Local content listener; DOM-local.                                    |
| 21  | `OrganizationSwitcher`                                                 | Local org switcher listener; DOM-local.                               |
| 22  | `SettingsView` navigation hook                                         | Settings navigation; DOM-local.                                       |
| 23  | `OpenAICodexRateLimitDashboard`                                        | Local rate-limit dashboard; DOM-local.                                |
| 24  | `LiteLLM` hook                                                         | Local LiteLLM hook listener; DOM-local.                               |
| 25  | `CreateWorktreeModal`                                                  | Local modal listener; DOM-local.                                      |
| 26  | `PromptsSettings`                                                      | Local prompts settings listener; DOM-local.                           |
| 27  | `WorktreesView` (×2)                                                   | Local worktrees view listeners; DOM-local.                            |
| 28  | `DeleteWorktreeModal`                                                  | Local delete modal listener; DOM-local.                               |
| 29  | `code-index-popover-hooks` (×3)                                        | Local code-index popover hooks; DOM-local.                            |
| 30  | `status-badge`                                                         | Local status badge listener; DOM-local.                               |
| 31  | `useModesViewState-ui`                                                 | Local modes-view state hook; DOM-local.                               |
| 32  | `Marketplace` (visibility / useStateManager / ItemCard / InstallModal) | Marketplace visibility + install UI; DOM-local.                       |
| 33  | `credit-balance` hook                                                  | Local credit-balance hook; DOM-local.                                 |
| 34  | `DismissibleUpsell`                                                    | Local dismissible upsell UI; DOM-local.                               |

**Count: 34 distinct class B entries** (some entries group multiple co-located listeners, e.g. WorktreesView ×2, code-index-popover-hooks ×3, Marketplace group).

## Gate D0

- [x] Allowlist covers ALL class B files named in §2.4 line 113 (34 entries).
- [x] §2.4 citation: [`architecture-v4-connector-abstraction.md`](architecture-v4-connector-abstraction.md:113) line 113 (class B list); class B row at line 107; C-3 criterion at lines 687–695.
- [x] File staged by literal path: `plans/phase-d-class-b-allowlist.md`.

## Note on count vs. plan prose

The D0 chunk header in [`plans/phase-d-implementation-plan.md`](phase-d-implementation-plan.md:64) describes "~20 DOM-local files". The authoritative §2.4 line 113 list enumerates **34 distinct class B entries** (several group multiple co-located listeners). Per Gate D0 ("the allowlist covers ALL class B files from §2.4"), this allowlist includes every entry from the §2.4 list; the "~20" figure in the chunk header is an approximation and the actual frozen count is 34.
