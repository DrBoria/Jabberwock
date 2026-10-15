const fs = require("node:fs");
const path = require("node:path");
const SRC = path.join(__dirname, "..", "packages", "vscode-extension-devtool-mcp", "src");

function listFiles(dir) {
	const out = [];
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, e.name);
		if (e.isDirectory()) out.push(...listFiles(full));
		else out.push(full);
	}
	return out;
}

const re = /(?:from\s+|import\s*\()\s*["'](\.[^"']+)["']/g;
let bad = 0;
let total = 0;
for (const f of listFiles(SRC).filter((f) => /\.(ts|tsx|mjs)$/.test(f))) {
	const t = fs.readFileSync(f, "utf8");
	// Mask block comments and line comments so JSDoc examples don't count as imports.
	const masked = t
		.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
		.replace(/(^|\n)\s*\/\/.*/g, (c) => c.replace(/[^\n]/g, " "));
	let m;
	while ((m = re.exec(masked)) !== null) {
		total++;
		const spec = m[1];
		const base = spec.replace(/\.(js|jsx)$/, "");
		const cands = [base + ".ts", base + ".tsx", base + ".mjs", base + ".js", base + ".css", base + ".json", base];
		const ok = cands.some((c) => fs.existsSync(path.resolve(path.dirname(f), c)));
		if (!ok) {
			bad++;
			console.log(`BROKEN: ${path.relative(SRC, f)} -> ${spec}`);
		}
	}
}
console.log(`checked=${total} broken=${bad}`);
if (bad) process.exitCode = 1;
