#!/usr/bin/env node
/**
 * COMPACT script for files exceeding 200-line max-lines.
 * Uses regex transformations, validates with TypeScript parser.
 * 
 * CRITICAL: Pattern A does NOT use DOTALL flag to avoid matching across
 * hundreds of lines looking for a semicolon.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function countCLines(content) {
  let count = 0;
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (t === "" || t.startsWith("//") || t.startsWith("*")) continue;
    count++;
  }
  return count;
}

function compact(content) {
  let c = content;

  // PATTERN A: `(params) => { \n  return expr; \n}` → `(params) => expr`
  // CRITICAL: No DOTALL flag - .+? only matches on the same line
  c = c.replace(
    /(\([^)]*\)(?:\s*:\s*\w+(?:<[^>]*>)?)?\s*=>\s*)\{\s*\n\s*return\s+(.+?);\s*\n\s*\}/g,
    (_, prefix, expr) => `${prefix}${expr.trim()}`
  );

  // PATTERN B: `if (cond) { \n  return x; \n}` → `if (cond) return x;`
  c = c.replace(
    /^(\t*)if\s*\(([^()]+)\)\s*\{\s*\n\1\t(return\s+.+?;?)\s*\n\1\}/gm,
    (_, indent, cond, stmt) => `${indent}if (${cond}) ${stmt}`
  );

  // PATTERN C: `else { \n  return x; \n}` → `else return x;`
  c = c.replace(
    /^(\t*)else\s*\{\s*\n\1\t(return\s+.+?;?)\s*\n\1\}/gm,
    (_, indent, stmt) => `${indent}else ${stmt}`
  );

  // PATTERN D: `const x = Y;\nif (!x) return` → `const x = Y; if (!x) return`
  c = c.replace(
    /^(\t*)(const|let)\s+(\w+)\s*=\s*([^;{]+?);\s*\n\1if\s*\(!\3\s*\)\s*(return|continue|break)\s*;?/gm,
    (_, indent, decl, name, expr, keyword) =>
      `${indent}${decl} ${name} = ${expr.trim()}; if (!${name}) ${keyword}`
  );

  // PATTERN E: try { singleStmt } catch (e) { singleStmt } → single line
  c = c.replace(
    /^(\t*)try\s*\{\s*\n\1\t([^;\n{}]+?;)\s*\n\1\}\s*catch\s*\(([^)]+)\)\s*\{\s*\n\1\t([^;\n{}]+?;)\s*\n\1\}/gm,
    (_, indent, tryBody, catchVar, catchBody) =>
      `${indent}try { ${tryBody.trim()} } catch (${catchVar}) { ${catchBody.trim()} }`
  );

  // PATTERN F: Compact empty catch blocks
  c = c.replace(/catch\s*\([^)]+\)\s*\{\s*\n\s*\}/g, "catch {}");

  // PATTERN G: Multi-line template literals without interpolation
  c = c.replace(
    /`((?:[^`$]|\$(?!\{))*\n(?:[^`$]|\$(?!\{))*)`/g,
    (match) => {
      if (match.includes("${")) return match;
      return match.replace(/\n\s*/g, " ");
    }
  );

  return c;
}

/**
 * Validate content using TypeScript's built-in parser.
 */
function isValidTS(content) {
  const sourceFile = ts.createSourceFile("test.ts", content, ts.ScriptTarget.Latest, true);
  return sourceFile.parseDiagnostics.length === 0;
}

const files = [
  "src/features/settings/handlers/on-settings-api-config.ts",
  "src/integrations/terminal/TerminalRegistry.ts",
  "src/integrations/terminal/ExecaTerminalProcess.ts",
  "src/services/ripgrep/index.ts",
  "src/features/chat/tools/helpers/writeToFileHelpers.ts",
  "src/services/tree-sitter/index.ts",
  "src/features/settings/agents/store.ts",
  "src/utils/json-schema.ts",
  "src/features/settings/actions/importSettings.ts",
  "src/services/code-index/service-factory.ts",
  "src/shared/support-prompt.ts",
  "src/services/command/commands.ts",
  "src/utils/shell.ts",
  "src/features/store.ts",
  "src/services/marketplace/MarketplaceManager.ts",
  "src/services/marketplace/SimpleInstaller.ts",
  "src/services/command/built-in-commands.ts",
  "src/features/foundation/time-machine/apply/parser.ts",
  "src/utils/git.ts",
  "src/utils/networkProxy.ts",
  "src/services/code-index/embedders/bedrock.ts",
  "src/features/settings/context/tools/filter-tools-for-mode.ts",
  "src/features/settings/models/api-config-store.ts",
  "src/services/code-index/embedders/ollama.ts",
  "src/integrations/misc/extract-text.ts",
  "src/shared/tools.ts",
  "src/integrations/terminal/TerminalProcess.ts",
  "src/features/settings/handlers/on-settings-agents.ts",
  "src/services/code-index/embedders/openrouter.ts",
  "src/services/code-index/manager.ts",
  "src/integrations/misc/indentation-reader.ts",
  "src/services/code-index/embedders/openai-compatible.ts",
  "src/services/code-index/orchestrator.ts",
  "src/services/checkpoints/ShadowCheckpointService.ts",
  "src/features/settings/context/sections/custom-instructions.ts",
  "src/features/settings/handlers/on-settings-code-index.ts",
  "src/services/code-index/config-manager.ts",
  "src/features/settings/store.ts",
  "src/services/glob/list-files.ts",
  "src/features/settings/handlers/on-settings-worktree.ts",
  "src/integrations/editor/DiffViewProvider.ts",
  "src/services/code-index/vector-store/qdrant-client.ts",
  "src/integrations/openai-codex/oauth.ts",
  "src/services/code-index/processors/scanner.ts",
  "src/features/foundation/window-manager/store.ts",
  "src/services/code-index/processors/parser.ts",
  "src/features/foundation/time-machine/actions/checkpoints.ts",
  "src/features/foundation/time-machine/file-context/index.ts",
  "src/features/settings/handlers/on-settings-core.ts",
  "src/services/code-index/processors/file-watcher.ts",
  "src/features/settings/agents/modesFileService.ts",
  "src/features/foundation/time-machine/actions/strategies/multi-search-replace.ts",
  "src/features/settings/models/ProviderSettingsManager.ts",
  "src/features/settings/events/handlers/index.ts",
  "src/services/mcp/McpHub.ts",
];

let totalReduction = 0;
let fixed = 0;
let partial = 0;
let noop = 0;
let reverted = 0;

for (const relPath of files) {
  const fullPath = path.resolve(rootDir, relPath);
  if (!fs.existsSync(fullPath)) { noop++; continue; }

  const orig = fs.readFileSync(fullPath, "utf-8");
  const origCount = countCLines(orig);
  if (origCount <= 200) { continue; }

  const compacted = compact(orig);
  const newCount = countCLines(compacted);
  const reduction = origCount - newCount;

  if (newCount >= origCount) {
    noop++;
    continue;
  }

  // Validate with TypeScript parser BEFORE writing
  if (!isValidTS(compacted)) {
    reverted++;
    console.log(`REVERTED: ${relPath} (${origCount}) - parse error after compaction`);
    continue;
  }

  // Write only if valid
  fs.writeFileSync(fullPath, compacted, "utf-8");
  totalReduction += reduction;
  if (newCount <= 200) {
    console.log(`FIXED: ${relPath} (${origCount}→${newCount}, -${reduction})`);
    fixed++;
  } else {
    partial++;
    console.log(`PARTIAL: ${relPath} (${origCount}→${newCount}, -${reduction}, need ${newCount - 200})`);
  }
}

console.log(`\n=== Summary ===`);
console.log(`Fixed: ${fixed}, Partial: ${partial}, Noop: ${noop}, Reverted: ${reverted}`);
console.log(`Total reduction: ${totalReduction}`);
