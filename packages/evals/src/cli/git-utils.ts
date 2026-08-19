import { execa } from "execa"

import type { Run } from "../db/index"

export const resetEvalsRepo = async ({ run, cwd }: { run: Run; cwd: string }) => {
	await execa({ cwd })`git config user.name "Jabberwock"`
	await execa({ cwd })`git config user.email "support@jabberwock.com"`
	await execa({ cwd })`git checkout -f`
	await execa({ cwd })`git clean -fd`
	await execa({ cwd })`git checkout -b runs/${run.id}-${crypto.randomUUID().slice(0, 8)} main`
}

export const commitEvalsRepoChanges = async ({ run, cwd }: { run: Run; cwd: string }) => {
	await execa({ cwd })`git add .`
	await execa({ cwd })`git commit -m ${`Run #${run.id}`} --no-verify`
}
