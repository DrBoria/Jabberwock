import { OutputFormat } from "@/types/index.js"
import { ExtensionHost, ExtensionHostOptions } from "@/agent/index.js"
import { isExpectedControlFlowError } from "../../cancellation.js"
import { normalizeError } from "./errors.js"
import type { FlagOptionsWithDebug } from "../core/core.js"
import { warmupHost, executeTaskWithResume, createPrintModeHelpers } from "../core/core.js"

export async function runPrintMode(
	e: ExtensionHostOptions,
	o: OutputFormat,
	usp: boolean,
	soe: boolean,
	f: FlagOptionsWithDebug,
	prompt: string | undefined,
	rcs: string | undefined,
	irr: boolean,
	rrs: string | undefined,
): Promise<void> {
	const ujo = o === "json" || o === "stream-json"
	e.disableOutput = ujo
	const host = new ExtensionHost(e)
	let isd = false,
		hd = false
	const {
		jsonEmitter: je,
		setStreamRequestId: ssr,
		emitRuntimeError: ere,
		clearKeepAliveInterval: ck,
		flushStdout: fs2,
		parkUntilSignal: pus,
	} = createPrintModeHelpers(ujo, soe)
	const dh = async () => {
		if (hd) return
		hd = true
		je?.detach()
		await host.dispose()
	}
	const shutdown = async (sig: string, ec: number): Promise<void> => {
		if (isd) return
		isd = true
		process.off("SIGINT", si)
		process.off("SIGTERM", st)
		process.off("uncaughtException", uce)
		process.off("unhandledRejection", uhr)
		ck()
		if (!ujo) {
			console.log(`\n[CLI] Received ${sig}, shutting down...`)
		}
		await dh()
		await je?.flush()
		await fs2()
		process.exit(ec)
	}
	const si = () => {
			void shutdown("SIGINT", 130)
		},
		st = () => {
			void shutdown("SIGTERM", 143)
		}
	const uce = (error: Error) => {
		if (isExpectedControlFlowError(error, { stdinStreamMode: usp, shuttingDown: isd, operation: "runtime" })) return
		ere(error, "uncaughtException")
		if (!soe) {
			void shutdown("uncaughtException", 1)
		}
	}
	const uhr = (reason: unknown) => {
		if (isExpectedControlFlowError(reason, { stdinStreamMode: usp, shuttingDown: isd, operation: "runtime" }))
			return
		ere(normalizeError(reason), "unhandledRejection")
		if (!soe) {
			void shutdown("unhandledRejection", 1)
		}
	}
	process.on("SIGINT", si)
	process.on("SIGTERM", st)
	process.on("uncaughtException", uce)
	process.on("unhandledRejection", uhr)
	try {
		await warmupHost(host, e, f)
		await executeTaskWithResume(host, je, usp, irr, rrs, prompt, rcs, o, ssr)
		await dh()
		await je?.flush()
		await fs2()
		if (soe) {
			await pus("Task loop completed")
		}
		process.off("SIGINT", si)
		process.off("SIGTERM", st)
		process.off("uncaughtException", uce)
		process.off("unhandledRejection", uhr)
		process.exit(0)
	} catch (error) {
		ere(normalizeError(error))
		await dh()
		await je?.flush()
		await fs2()
		if (soe) {
			await pus("Task loop failed")
		}
		process.off("SIGINT", si)
		process.off("SIGTERM", st)
		process.off("uncaughtException", uce)
		process.off("unhandledRejection", uhr)
		process.exit(1)
	}
}
