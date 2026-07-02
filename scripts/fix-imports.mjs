#!/usr/bin/env node
/**
 * Script to convert all `../` relative imports in src/ to `@`-prefixed absolute imports.
 * This handles the `no-restricted-imports` ESLint rule that bans parent-relative imports.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs"
import { join, relative, resolve, dirname, sep } from "path"

const SRC_DIR = resolve(import.meta.dirname, "../src")

// Path aliases from tsconfig (must match tsconfig.json exactly)
const ALIASES = {
  "@activate/*": "./activate/*",
  "@api/*": "./api/*",
  "@assets/*": "./assets/*",
  "@extension-activation/*": "./extension-activation/*",
  "@features/*": "./features/*",
  "@foundation/*": "./features/foundation/*",
  "@i18n": "./i18n",
  "@i18n/*": "./i18n/*",
  "@integrations/*": "./integrations/*",
  "@logs/*": "./logs/*",
  "@packages/*": "../packages/*",
  "@root/*": "./*",
  "@services/*": "./services/*",
  "@shared/*": "./shared/*",
  "@types/*": "./types/*",
  "@utils/*": "./utils/*",
  "@workers/*": "./workers/*",
  "@intentConstants": "./features/intents/IntentConstants",
  "@eventConstants": "../packages/types/src/event-constants",
}

// Aliases that are exact (non-wildcard)
const EXACT_ALIASES = {
  "i18n": "@i18n",
  "i18n/index": "@i18n",
  "features/intents/IntentConstants": "@intentConstants",
}

// Wildcard aliases: prefix match
const WILDCARD_ALIASES = Object.entries(ALIASES)
  .filter(([key]) => key.endsWith("/*"))
  .map(([alias, target]) => ({
    aliasPrefix: alias.slice(0, -2),
    targetPrefix: target.replace(/^\.\//, "").replace(/\/\*$/, ""),
  }))

/**
 * Resolve a relative import path to an absolute path under src/ directory.
 */
function resolveRelativeImport(importPath, sourceFileRel) {
  const sourceDir = dirname(sourceFileRel)
  const resolved = join(sourceDir, importPath)
  return resolved.replace(/\\/g, "/")
}

/**
 * Check if a path matches an alias and return the aliased import path.
 */
function pathToAlias(resolvedPath) {
  let normalized = resolvedPath.replace(/\\/g, "/")
  if (normalized.startsWith("./")) {
    normalized = normalized.slice(2)
  }

  // Check exact matches first
  if (EXACT_ALIASES[normalized]) {
    return EXACT_ALIASES[normalized]
  }

  // Check wildcard aliases
  for (const { aliasPrefix, targetPrefix } of WILDCARD_ALIASES) {
    if (normalized === targetPrefix) {
      return aliasPrefix
    }
    if (normalized.startsWith(targetPrefix + "/")) {
      const rest = normalized.slice(targetPrefix.length)
      return aliasPrefix + rest
    }
  }

  return null
}

/**
 * Fix import paths in a line.
 */
function fixImportLine(line, sourceFileRel) {
  const patterns = [
    // import ... from "..."
    /(from\s+["'])(\.\.\/[^"']+)(["'])/,
    // require("...")
    /(require\(["'])(\.\.\/[^"']+)(["']\))/,
    // import("...")
    /(import\(["'])(\.\.\/[^"']+)(["']\))/,
  ]

  for (const pattern of patterns) {
    const match = line.match(pattern)
    if (!match) continue

    const prefix = match[1]
    const relPath = match[2]
    const suffix = match[3]

    const resolvedPath = resolveRelativeImport(relPath, sourceFileRel)
    const aliasedPath = pathToAlias(resolvedPath)

    if (!aliasedPath) {
      console.warn(`  ⚠️  Cannot map: ${relPath} -> ${resolvedPath} in ${sourceFileRel}`)
      continue
    }

    const before = line.slice(0, match.index)
    const after = line.slice(match.index + match[0].length)
    return before + prefix + aliasedPath + suffix + after
  }

  return null
}

function processFile(filePath, relPath) {
  let content
  try {
    content = readFileSync(filePath, "utf-8")
  } catch {
    return { fixed: 0, skipped: 0 }
  }

  const lines = content.split("\n")
  let fixed = 0
  let skipped = 0
  const newLines = []

  for (const line of lines) {
    // Skip lines without ../ patterns early
    if (!line.includes("../")) {
      newLines.push(line)
      continue
    }

    const fixedLine = fixImportLine(line, relPath)
    if (fixedLine) {
      newLines.push(fixedLine)
      fixed++
    } else {
      skipped++
      newLines.push(line)
    }
  }

  if (fixed > 0) {
    writeFileSync(filePath, newLines.join("\n"), "utf-8")
  }

  return { fixed, skipped }
}

function walkDir(dir, baseDir, results = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return results
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    if (entry.startsWith(".") || entry === "node_modules" || entry === "dist" || entry === "webview-ui" || entry === "logs") continue
    try {
      const s = statSync(fullPath)
      if (s.isDirectory()) {
        walkDir(fullPath, baseDir, results)
      } else if (s.isFile() && /\.(ts|tsx)$/.test(entry) && !entry.endsWith(".d.ts")) {
        results.push(fullPath)
      }
    } catch { /* skip */ }
  }
  return results
}

console.log("🔍 Scanning files in src/...")
const files = walkDir(SRC_DIR, SRC_DIR)
console.log(`📁 Found ${files.length} files to process`)

let totalFixed = 0
let totalSkipped = 0
let filesWithChanges = 0

for (const filePath of files) {
  const relPath = relative(SRC_DIR, filePath)
  const { fixed, skipped } = processFile(filePath, relPath)
  if (fixed > 0) {
    console.log(`  ✅ ${relPath}: ${fixed} import(s) fixed`)
    filesWithChanges++
  }
  totalFixed += fixed
  totalSkipped += skipped
}

console.log(`\n📊 Results:`)
console.log(`  Files modified: ${filesWithChanges}`)
console.log(`  Imports fixed:  ${totalFixed}`)
console.log(`  Imports skipped: ${totalSkipped}`)
console.log(`  Done!`)
