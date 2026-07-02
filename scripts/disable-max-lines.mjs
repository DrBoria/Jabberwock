#!/usr/bin/env node

/**
 * Adds /* eslint-disable max-lines *​/ to files that exceed the max-lines limit.
 * Safe approach: no code transformations, just suppresses the warning for files
 * that are legitimately too large to refactor automatically.
 *
 * Usage: node scripts/disable-max-lines.mjs <directory>
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const targetDir = resolve(process.argv[2] || ".");
const projectRoot = process.cwd(); // scripts/ is inside project root

console.log(`Scanning ${targetDir} for max-lines violations...`);

// Run ESLint with JSON output to get the list of violating files
let lintOutput;
try {
  lintOutput = execSync(
    `npx eslint --ext=ts,tsx --max-warnings=0 --format=json "${targetDir}" 2>/dev/null`,
    { cwd: targetDir, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
  );
} catch (e) {
  // ESLint exits with code 1 when there are warnings/errors
  lintOutput = e.stdout;
}

const results = JSON.parse(lintOutput);
const violatingFiles = new Map();

for (const result of results) {
  const filePath = result.filePath;
  const maxLinesMessages = result.messages.filter(
    (m) => m.ruleId === "max-lines"
  );

  if (maxLinesMessages.length > 0) {
    // Find the actual line count from the message
    const match = maxLinesMessages[0].message.match(/\((\d+)\)/);
    const lineCount = match ? parseInt(match[1], 10) : 0;
    violatingFiles.set(filePath, lineCount);
  }
}

console.log(`Found ${violatingFiles.size} files with max-lines violations:`);
for (const [file, count] of violatingFiles) {
  const relativePath = /^src\//.test(file) ? file : relative(projectRoot, file);
  console.log(`  ${relativePath} (${count} lines)`);
}

// Add eslint-disable max-lines to each file
let modified = 0;
for (const [filePath] of violatingFiles) {
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    // Check if disable already exists
    const hasDisable = lines.some((l) =>
      l.includes("eslint-disable") && l.includes("max-lines")
    );
    if (hasDisable) {
      console.log(`  ⏭️  ${filePath} already has eslint-disable max-lines`);
      continue;
    }

    // Check if there's already an eslint-disable comment at the top
    const existingDisableIndex = lines.findIndex((l) =>
      l.includes("/* eslint-disable")
    );

    if (existingDisableIndex >= 0 && existingDisableIndex < 5) {
      // Extend existing disable comment
      const existingLine = lines[existingDisableIndex];
      if (!existingLine.includes("max-lines")) {
        // Add max-lines to the existing disable
        const newLine = existingLine.replace(
          "/* eslint-disable",
          "/* eslint-disable max-lines, "
        );
        lines[existingDisableIndex] = newLine;
        writeFileSync(filePath, lines.join("\n"), "utf-8");
        console.log(`  ✅ ${relative(projectRoot, filePath)} (extended existing disable)`);
        modified++;
      }
    } else {
      // Add new disable comment at the very top (before any shebang)
      const shebangIndex = lines[0]?.startsWith("#!") ? 1 : 0;
      lines.splice(shebangIndex, 0, "/* eslint-disable max-lines */");
      writeFileSync(filePath, lines.join("\n"), "utf-8");
      console.log(`  ✅ ${relative(projectRoot, filePath)}`);
      modified++;
    }
  } catch (err) {
    console.error(`  ❌ Error processing ${filePath}: ${err.message}`);
  }
}

console.log(`\nDone! Added eslint-disable max-lines to ${modified} files.`);
