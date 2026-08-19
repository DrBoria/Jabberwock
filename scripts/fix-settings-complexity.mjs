#!/usr/bin/env node
/**
 * Fixes the complexity warning in SettingsView.tsx by extracting
 * complex inline expressions into variables before the return statement.
 */

import { readFileSync, writeFileSync } from "node:fs"

const filePath = "webview-ui/src/features/settings/components/SettingsView.tsx"
let content = readFileSync(filePath, "utf-8")

// Add variables before the return statement to reduce complexity
const returnMatch = content.match(/^(\t*)return \($/m)
if (!returnMatch) {
  console.error("Could not find 'return (' in file")
  process.exit(1)
}

const indent = returnMatch[1]
const variables = `
${indent}const saveButtonTooltip = !isSettingValid
${indent}\t? t("settings:header.saveButtonTooltip") + " (with provider warnings)"
${indent}\t: isChangeDetected
${indent}\t\t? t("settings:header.saveButtonTooltip")
${indent}\t\t: t("settings:header.nothingChangedTooltip")
${indent}const saveButtonClass = !isSettingValid ? "!border-vscode-errorForeground" : ""
${indent}const containerClass = cn(settingsTabsContainer, isCompactMode && "narrow")
${indent}const tabContentClass = cn("p-0 flex-1 overflow-auto", isIndexing && "opacity-0")
`

// Insert before the `return (` line
const returnIndex = content.search(/^(\t*)return \($/m)
content = content.slice(0, returnIndex) + variables + "\n" + content.slice(returnIndex)

// Replace the inline expressions with the variables
content = content.replace(
  /<StandardTooltip\n\t\t\t\t\t\tcontent={\n\t\t\t\t\t\t\t!isSettingValid\n\t\t\t\t\t\t\t\t\? t\("settings:header\.saveButtonTooltip"\) \+ " \(with provider warnings\)"\n\t\t\t\t\t\t\t\t: isChangeDetected\n\t\t\t\t\t\t\t\t\t\? t\("settings:header\.saveButtonTooltip"\)\n\t\t\t\t\t\t\t\t\t: t\("settings:header\.nothingChangedTooltip"\)\n\t\t\t\t\t\t}>/,
  "<StandardTooltip\n\t\t\t\t\t\tcontent={saveButtonTooltip}>"
)

content = content.replace(
  /className=\{!isSettingValid \? "!border-vscode-errorForeground" : ""\}/,
  "className={saveButtonClass}"
)

content = content.replace(
  /className=\{cn\(settingsTabsContainer, isCompactMode && "narrow"\)\}/,
  "className={containerClass}"
)

content = content.replace(
  /className=\{cn\("p-0 flex-1 overflow-auto", isIndexing && "opacity-0"\)\}/,
  "className={tabContentClass}"
)

writeFileSync(filePath, content, "utf-8")
console.log("Fixed SettingsView.tsx complexity warning")
