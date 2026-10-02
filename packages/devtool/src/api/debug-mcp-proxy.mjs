#!/usr/bin/env node
/**
 * debug-mcp-proxy.mjs — zero-dependency stdio <-> Streamable HTTP MCP bridge.
 *
 * Speaks newline-delimited JSON-RPC on stdin/stdout (the MCP "stdio" transport)
 * and proxies every message to the DebugMCP extension's Streamable HTTP server
 * at http://127.0.0.1:54321/mcp, forwarding responses back verbatim so tool
 * names/schemas surface unchanged under the mcp--debug-mcp-* prefix.
 *
 * Why this exists: agent-session MCP clients reliably spawn stdio servers but
 * silently skip "streamable-http" entries in .roo/mcp.json, while DebugMCP only
 * exposes its server over Streamable HTTP. Launched by plain `node` (no tsx and
 * no npm dependencies).
 *
 * Protocol notes:
 *  - Each stdin line is one JSON-RPC message or batch array; each reply we emit
 *    is exactly one such line as well.
 *  - Upstream POSTs use Content-Type application/json plus Accept "application/
 *    json, text/event-stream" per the MCP Streamable HTTP spec.
 *  - The Mcp-Session-Id response header from "upstream" (if any) is captured once
 *    and echoed on all subsequent requests.
 *  - Upstream may answer with a plain JSON body or an SSE stream; for SSE we
 *    parse events until the message carrying our request id arrives, then stop.
 *  - Notifications carry no id: they are forwarded upstream and never answered.
 */

import { createInterface } from "node:readline";

const UPSTREAM_URL = process.env.DEBUG_MCP_BRIDGE_UPSTREAM ?? "http://127.0.0.1:54321/mcp";
const REQUEST_TIMEOUT_MS = 120_000; // stay under any client-side tool timeout

let mcpSessionId = null; // Mcp-Session-Id issued by upstream, echoed on later requests.

function log(...args) {
    console.error("[debug-mcp-proxy]", ...args);
}

/** Emit one JSON-RPC message (or batch) to the client as a single line. */
function sendToClient(rawJsonLine) {
    process.stdout.write(`${rawJsonLine}\n`);
}

function errorResponse(id, code, message) {
    return JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
}

/** Collect the request ids carried by a single message or batch array. */
function collectIds(message) {
    const messages = Array.isArray(message) ? message : [message];
    return messages.filter((m) => m && typeof m === "object" && !Array.isArray(m) && m.id !== undefined).map((m) => m.id);
}

/** True when `value` is a JSON-RPC object whose id matches one of ours. */
function answersAny(value, ids) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return value.id !== undefined && ids.some((id) => String(id) === String(value.id));
}

/**
 * Read an upstream SSE stream and collect the raw data payloads of every event
 * that answers one of `ids`. Stops as soon as all ids are matched or the server
 * closes the stream. Returns [] when nothing matches (caller synthesizes error).
 */
async function readSseMatches(bodyStream, ids) {
    const reader = bodyStream.getReader();
    const decoder = new TextDecoder();
    const matchedLines = [];
    const answeredIds = new Set(); // our request ids already seen in the stream
    let buffer = "";
    let dataLines = []; // "data:" fields of the in-flight SSE event

    const allAnswered = () => ids.every((id) => answeredIds.has(String(id)));

    function handleLine(line) {
        if (line === "") {
            // Blank line terminates the current SSE event.
            if (dataLines.length > 0) {
                const payload = dataLines.join("\n");
                dataLines = [];
                try {
                    const parsed = JSON.parse(payload);
                    const messages = Array.isArray(parsed) ? parsed : [parsed];
                    for (const m of messages) {
                        if (answersAny(m, ids)) answeredIds.add(String(m.id));
                    }
                    // Forward the event verbatim when it answers one of our requests.
                    if (messages.some((m) => answersAny(m, ids))) matchedLines.push(payload);
                } catch {
                    /* not JSON — ignore this SSE event */
                }
            }
        } else if (line.startsWith("data:")) {
            const raw = line.slice(5); // strip the colon; keep one optional leading space per the SSE spec
            dataLines.push(raw.startsWith(" ") ? raw.slice(1) : raw);
        }
        // Other fields (event:, id:, retry:) are irrelevant for MCP.
    }

    try {
        for (;;) {
            if (allAnswered()) break;
            const chunk = await reader.read();
            if (chunk.done) {
                if (buffer.length > 0 && !allAnswered()) handleLine(buffer); // final unterminated line, if any
                break;
            }
            buffer += decoder.decode(chunk.value, { stream: true });
            let newlineIndex = buffer.indexOf("\n");
            while (newlineIndex !== -1) {
                const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
                buffer = buffer.slice(newlineIndex + 1);
                handleLine(line);
                if (allAnswered()) break; // stop reading as soon as we have everything
                newlineIndex = buffer.indexOf("\n");
            }
        }
    } finally {
        try { await reader.cancel(); } catch { /* stream already closed */ }
    }

    return matchedLines;
}

//** POST one message to upstream and capture any Mcp-Session-Id it issues. */
async function postToUpstream(message) {
    const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
    if (mcpSessionId !== null) headers["Mcp-Session-Id"] = mcpSessionId;

    const res = await fetch(UPSTREAM_URL, { method: "POST", body: JSON.stringify(message), headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

    // Capture the session id once and echo it on all subsequent requests.
    const sessionId = res.headers.get("mcp-session-id");
    if (sessionId && mcpSessionId === null) {
        mcpSessionId = sessionId;
        log(`captured Mcp-Session-Id: ${sessionId.slice(0, 8)}...`);
    }

    return res;
}

/** Handle a plain JSON upstream body. Returns true when a reply was emitted to the client. */
async function handlePlainJson(res) {
    const text = await res.text().catch(() => "");
    if (text.trim() === "") return false; // e.g. 202 with an empty body — nothing usable here
    try {
        JSON.parse(text); // only forward valid JSON-RPC verbatim
        sendToClient(text.trim());
        return true;
    } catch {
        /* not JSON-RPC — caller synthesizes the error reply */
        return false;
    }
}

/** Handle an SSE upstream body. Returns true when a matching reply was emitted to the client. */
async function handleSse(res, ids) {
    const matchedLines = await readSseMatches(res.body, ids).catch((err) => { log("upstream SSE stream failed:", err instanceof Error ? err.message : String(err)); return []; });
    for (const line of matchedLines) sendToClient(line);
    return matchedLines.length > 0;
}

/** Forward one client message to upstream and echo the matching reply back. */
async function proxyMessage(message) {
    const ids = collectIds(message);

    let res;
    try {
        res = await postToUpstream(message);
    } catch (err) {
        const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        log("upstream request failed:", detail);
        for (const id of ids) sendToClient(errorResponse(id, -32603, `debug-mcp-proxy: upstream unreachable (${detail})`));
        return; // notifications have no reply to synthesize
    }

    // Notifications carry no id: upstream answers with an empty body / 202. Drain and move on.
    if (ids.length === 0) {
        await res.arrayBuffer().catch(() => undefined);
        return;
    }

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    let replied = false;
    if (contentType.includes("text/event-stream")) {
        // SSE response: parse events until the message carrying our request id arrives.
        replied = await handleSse(res, ids);
    } else {
        // Plain JSON response: forward verbatim when it is valid JSON-RPC.
        replied = await handlePlainJson(res);
    }

    // Upstream produced no usable JSON-RPC answer: synthesize one so the client never hangs.
    if (!replied) {
        log(`no JSON-RPC response from "upstream" for id(s) ${ids.join(",")} (HTTP ${res.status}, content-type "${contentType}")`);
        const detail = `debug-mcp-proxy: no JSON-RPC response from "upstream" (HTTP ${res.status})`;
        for (const id of ids) sendToClient(errorResponse(id, -32603, detail));
    }
}

async function main() {
    log(`proxying stdio -> ${UPSTREAM_URL}`);
    const rl = createInterface({ input: process.stdin, terminal: false });
    for await (const line of rl) {
        if (line.trim() === "") continue; // ignore blank lines between messages

        let message;
        try {
            message = JSON.parse(line);
        } catch (err) {
            log("ignoring malformed stdin line:", err instanceof Error ? err.message : String(err));
            continue;
        }

        await proxyMessage(message).catch((err) => {
            // Never let one failed exchange kill the bridge.
            const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
            log("unexpected error while proxying message:", detail);
            for (const id of collectIds(message)) sendToClient(errorResponse(id, -32603, `debug-mcp-proxy: internal error (${detail})`));
        });
    }
    rl.close(); // stdin closed by the client — let stdout flush and exit naturally
}

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

main().catch((err) => { log("fatal:", err); process.exitCode = 1; });
