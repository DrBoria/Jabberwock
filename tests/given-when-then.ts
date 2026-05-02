/**
 * BDD Given/When/Then helpers for Jabberwock E2E tests.
 *
 * Wraps test.step() with descriptive prefixes (Given, When, Then, And)
 * so test reports read as natural language scenarios.
 *
 * Usage:
 *   import { test } from "./given-when-then"
 *   import { JabberwockApp } from "./JabberwockApp"
 *
 *   Scenario("User can navigate to History", async () => {
 *     const app = new JabberwockApp()
 *
 *     await Given("the app is connected", async () => {
 *       await app.connect()
 *     })
 *
 *     await When("I navigate to the History page", async () => {
 *       await app.navigateToHistory()
 *     })
 *
 *     await Then("the active page should be history", async () => {
 *       await app.verifyActivePage("history")
 *     })
 *   })
 */

// ── Test type helpers ────────────────────────────────────────────────────

/**
 * Minimal test function type — wraps a test case with a title and callback.
 * In a real Playwright setup this would be `test.extend(...)`.
 * Here it's a simple runner that logs the scenario and executes steps.
 */
export type TestType = {
	(title: string, fn: () => Promise<void>): Promise<void>
	step: TestStepType
}

/**
 * Test step type — wraps a step with a title and callback.
 */
export type TestStepType = {
	(title: string, fn: () => Promise<void>): Promise<void>
}

// ── Default test implementation ──────────────────────────────────────────

/**
 * Default test function that logs the scenario and runs the callback.
 */
export const test: TestType = Object.assign(
	async (title: string, fn: () => Promise<void>): Promise<void> => {
		console.log(`\n📋 Scenario: ${title}`)
		console.log("─".repeat(60))
		try {
			await fn()
			console.log("─".repeat(60))
			console.log(`✅ Scenario passed: ${title}\n`)
		} catch (error) {
			console.log("─".repeat(60))
			console.error(`❌ Scenario failed: ${title}`)
			throw error
		}
	},
	{
		step: async (title: string, fn: () => Promise<void>): Promise<void> => {
			console.log(`  ${title}`)
			await fn()
		},
	},
)

// ── BDD helpers ──────────────────────────────────────────────────────────

/**
 * Scenario — wraps test() with a descriptive title.
 * Replaces direct test() calls to add "Scenario: " prefix.
 */
export async function Scenario(...params: Parameters<TestType>): Promise<void> {
	const [title, ...rest] = params
	const modifiedTitle = `Scenario: ${title}`
	const modifiedParams = [modifiedTitle, ...rest] as const
	await test(...modifiedParams)
}

/**
 * Given — a step that sets up preconditions.
 * Prefixes the step title with "Given ".
 */
export async function Given(...params: Parameters<TestStepType>): Promise<void> {
	const [title, ...rest] = params
	const modifiedTitle = `Given ${title}`
	const modifiedParams = [modifiedTitle, ...rest] as const
	await test.step(...modifiedParams)
}

/**
 * When — a step that performs an action.
 * Prefixes the step title with "When ".
 */
export async function When(...params: Parameters<TestStepType>): Promise<void> {
	const [title, ...rest] = params
	const modifiedTitle = `When ${title}`
	const modifiedParams = [modifiedTitle, ...rest] as const
	await test.step(...modifiedParams)
}

/**
 * Then — a step that verifies an outcome.
 * Prefixes the step title with "Then ".
 */
export async function Then(...params: Parameters<TestStepType>): Promise<void> {
	const [title, ...rest] = params
	const modifiedTitle = `Then ${title}`
	const modifiedParams = [modifiedTitle, ...rest] as const
	await test.step(...modifiedParams)
}

/**
 * And — a step that adds additional context (can be used after Given, When, or Then).
 * Prefixes the step title with "And ".
 */
export async function And(...params: Parameters<TestStepType>): Promise<void> {
	const [title, ...rest] = params
	const modifiedTitle = `And ${title}`
	const modifiedParams = [modifiedTitle, ...rest] as const
	await test.step(...modifiedParams)
}

/**
 * Examples — data-driven test helper.
 * Iterates over test cases and calls the callback for each.
 *
 * Usage:
 *   await Examples([{ role: "admin" }, { role: "user" }], async (testCase) => {
 *     await Scenario(`Testing role: ${testCase.role}`, async () => { ... })
 *   })
 */
export async function Examples<T>(
	testCases: T[],
	callback: (testCase: T, index: number, array: T[]) => Promise<void>,
): Promise<void> {
	for (const [index, testCase] of testCases.entries()) {
		await callback(testCase, index, testCases)
	}
}
