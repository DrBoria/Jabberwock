import psTree from "ps-tree"
import process from "process"
import { execa } from "execa"

export function startPidUpdate(pid: number | undefined, callback: (newPid: number) => void): Promise<void> {
	if (!pid) {
		return Promise.resolve()
	}
	return new Promise<void>((resolve) => {
		setTimeout(() => {
			psTree(pid!, (err, children) => {
				if (!err && children.length > 0) {
					const actualPid = parseInt(children[0].PID)
					if (!isNaN(actualPid)) {
						callback(actualPid)
					}
				}
				resolve()
			})
		}, 100)
	})
}

export function handleAbortCleanup(
	aborted: boolean,
	pid: number | undefined,
	subprocess: ReturnType<typeof execa> | undefined,
	onCleanup: () => void,
): Promise<void> {
	if (!aborted) {
		return Promise.resolve()
	}

	let timeoutId: NodeJS.Timeout | undefined
	const kill = new Promise<void>((resolve) => {
		console.log(`[ExecaTerminalProcess#run] SIGKILL -> ${pid}`)
		timeoutId = setTimeout(() => {
			try {
				subprocess?.kill("SIGKILL")
			} catch {}
			resolve()
		}, 5_000)
	})

	const promise = Promise.race([subprocess, kill]).catch((error) => {
		console.log(
			`[ExecaTerminalProcess#run] subprocess termination error: ${error instanceof Error ? error.message : String(error)}`,
		)
	})

	return promise.then(() => {
		if (timeoutId) {
			clearTimeout(timeoutId)
		}
		if (onCleanup) {
			onCleanup()
		}
	})
}

export function performAbort(
	aborted: boolean,
	pid: number | undefined,
	subprocess: ReturnType<typeof execa> | undefined,
	pidUpdatePromise: Promise<void> | undefined,
): void {
	const performKill = () => {
		if (subprocess) {
			try {
				subprocess.kill("SIGKILL")
			} catch (e) {
				console.warn(
					`[jabberwock] [ExecaTerminalProcess#abort] Failed to kill subprocess: ${e instanceof Error ? e.message : String(e)}`,
				)
			}
		}

		if (pid) {
			try {
				process.kill(pid, "SIGKILL")
			} catch (e) {
				console.warn(
					`[jabberwock] [ExecaTerminalProcess#abort] Failed to kill process ${pid}: ${e instanceof Error ? e.message : String(e)}`,
				)
			}
		}
	}

	if (pidUpdatePromise) {
		pidUpdatePromise.then(performKill).catch(() => performKill())
	} else {
		performKill()
	}

	if (pid) {
		psTree(pid, async (err, children) => {
			if (!err) {
				const pids = children.map((p) => parseInt(p.PID))

				for (const childPid of pids) {
					try {
						process.kill(childPid, "SIGKILL")
					} catch (e) {
						console.warn(
							`[jabberwock] [ExecaTerminalProcess#abort] Failed to send SIGKILL to child PID ${childPid}: ${e instanceof Error ? e.message : String(e)}`,
						)
					}
				}
			} else {
				console.error(
					`[jabberwock] [ExecaTerminalProcess#abort] Failed to get process tree for PID ${pid}: ${err.message}`,
				)
			}
		})
	}
}
