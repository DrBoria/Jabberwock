import * as http from "http"
import { URL } from "url"
import { OPENAI_CODEX_OAUTH_CONFIG, exchangeCodeForTokens, OpenAiCodexCredentials } from "./oauthHelpers"

export function startOAuthCallbackServer(
	pendingAuth: { codeVerifier: string; state: string } | null,
	onCredentials: (credentials: OpenAiCodexCredentials) => Promise<void>,
): Promise<OpenAiCodexCredentials> {
	return new Promise((resolve, reject) => {
		const server = http.createServer(async (req, res) => {
			try {
				const url = new URL(req.url || "", `http://localhost:${OPENAI_CODEX_OAUTH_CONFIG.callbackPort}`)

				if (url.pathname !== "/auth/callback") {
					res.writeHead(404)
					res.end("Not Found")
					return
				}

				const code = url.searchParams.get("code")
				const state = url.searchParams.get("state")
				const error = url.searchParams.get("error")

				if (error) {
					res.writeHead(400)
					res.end(`Authentication failed: ${error}`)
					reject(new Error(`OAuth error: ${error}`))
					server.close()
					return
				}

				if (!code || !state) {
					res.writeHead(400)
					res.end("Missing code or state parameter")
					reject(new Error("Missing code or state parameter"))
					server.close()
					return
				}

				if (state !== pendingAuth?.state) {
					res.writeHead(400)
					res.end("State mismatch - possible CSRF attack")
					reject(new Error("State mismatch"))
					server.close()
					return
				}

				try {
					const credentials = await exchangeCodeForTokens(code, pendingAuth.codeVerifier)

					await onCredentials(credentials)

					res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
					res.end(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Authentication Successful</title>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    margin: 0;
    background: linear-gradient(135deg, #10a37f 0%, #0d8f6f 100%);
    color: white;
  }
  .container {
    text-align: center;
    padding: 2rem;
  }
  h1 { font-size: 2rem; margin-bottom: 1rem; }
  p { opacity: 0.9; }
</style>
</head>
<body>
<div class="container">
<h1>&#10003; Authentication Successful</h1>
<p>You can close this window and return to VS Code.</p>
</div>
<script>setTimeout(() => window.close(), 3000);</script>
</body>
</html>`)

					server.close()
					resolve(credentials)
				} catch (exchangeError) {
					res.writeHead(500)
					res.end(`Token exchange failed: ${exchangeError}`)
					reject(exchangeError)
					server.close()
				}
			} catch (err) {
				res.writeHead(500)
				res.end("Internal server error")
				reject(err)
				server.close()
			}
		})

		server.on("error", (err: NodeJS.ErrnoException) => {
			if (err.code === "EADDRINUSE") {
				reject(
					new Error(
						`Port ${OPENAI_CODEX_OAUTH_CONFIG.callbackPort} is already in use. ` +
							`Please close any other applications using this port and try again.`,
					),
				)
			} else {
				reject(err)
			}
		})

		const timeout = setTimeout(
			() => {
				server.close()
				reject(new Error("Authentication timed out"))
			},
			5 * 60 * 1000,
		)

		server.listen(OPENAI_CODEX_OAUTH_CONFIG.callbackPort)

		server.on("close", () => {
			clearTimeout(timeout)
		})
	})
}
