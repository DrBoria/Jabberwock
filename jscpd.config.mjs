/**
 * jscpd — project-wide duplication check (part of `pnpm check-all`).
 *
 * Replaces the old `local/no-duplicated-logic` ESLint rule (which only compared
 * siblings in one folder with a Dice coefficient). jscpd is a mature,
 * Rust-powered, project-wide clone detector: it catches "same logic, different
 * names" across the WHOLE repo (Type-1/2/3 clones), not just within a folder.
 *
 * The check fails when the number of exact clones exceeds `maxDuplicates`
 * (the grandfathered baseline). New duplication must be extracted into a
 * shared helper — the baseline must only SHRINK.
 *
 * Run: `pnpm dup-check` (wired into `pnpm check-all`).
 */

// Grandfathered baseline: number of exact clones present when jscpd went live.
// Every new clone pair is a real duplication to extract — lower this number as
// you deduplicate. Target: 0.
const BASELINE_DUPLICATES = 130

export default {
	threshold: 0,
	minTokens: 80,
	minLines: 12,
	// Only source code — skip tests, mocks, generated, locales, config artifacts.
	ignore: [
		"**/__tests__/**",
		"**/*.test.ts",
		"**/*.test.tsx",
		"**/*.spec.ts",
		"**/*.spec.tsx",
		"**/__mocks__/**",
		"**/*.d.ts",
		"**/dist/**",
		"**/build/**",
		"**/.next/**",
		"**/node_modules/**",
		"apps/cli/scripts/**",
		"connectors/web/backend/acceptance/**",
		"**/locales/**",
		"**/*.json",
		"**/*.css",
		"**/assets/**",
		"packages/config-eslint/**",
	],
	// Check the actual source roots of each workspace package.
	path: ["backend", "frontend/src", "apps/cli/src", "connectors", "packages"],
	// Fail the build if clones exceed the baseline.
	maxDuplicates: BASELINE_DUPLICATES,
	reporters: ["consoleFull"],
	format: ["typescript", "javascript"],
}
