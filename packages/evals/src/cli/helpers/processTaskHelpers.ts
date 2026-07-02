import { execa } from "execa"

import { Logger } from "./logging/logger"

const API_KEY_ENV_VARS = [
	"OPENROUTER_API_KEY",
	"ANTHROPIC_API_KEY",
	"OPENAI_API_KEY",
	"GOOGLE_API_KEY",
	"DEEPSEEK_API_KEY",
	"MISTRAL_API_KEY",
]

export function buildContainerDockerArgs(taskId: number, jobToken: string | null): string[] {
	const baseArgs = [
		"--rm",
		"--network evals_default",
		"-v /var/run/docker.sock:/var/run/docker.sock",
		"-v /tmp/evals:/var/log/evals",
		"-e HOST_EXECUTION_METHOD=docker",
	]

	if (jobToken) {
		baseArgs.push(`-e JABBERWOCK_CODE_CLOUD_TOKEN=${jobToken}`)
	}

	for (const envVar of API_KEY_ENV_VARS) {
		if (process.env[envVar]) {
			baseArgs.push(`-e ${envVar}=${process.env[envVar]}`)
		}
	}

	return baseArgs
}

export async function runContainerAttempt({
	args,
	command,
	logger,
}: {
	args: string[]
	command: string
	logger: Logger
}): Promise<boolean> {
	const subprocess = execa(`docker run ${args.join(" ")} evals-runner sh -c "${command}"`, { shell: true })

	try {
		const result = await subprocess
		logger.info(`container process completed with exit code: ${result.exitCode}`)
		return true
	} catch (error) {
		if (error && typeof error === "object" && "exitCode" in error) {
			logger.error(`container process failed with exit code: ${(error as { exitCode: number }).exitCode}`)
		} else {
			logger.error(`container process failed with error: ${error}`)
		}

		return false
	}
}
