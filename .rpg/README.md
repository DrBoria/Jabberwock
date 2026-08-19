# .rpg — Repository Planning Graph

This directory contains a **semantic code graph** built by [RPG-Encoder](https://github.com/userFRM/rpg-encoder).

## What is this?

`graph.json` is a pre-built semantic index of this codebase. It maps every function, class, and method to **what it does** (not just what it's called), along with dependency edges and a semantic hierarchy.

## Why is this committed?

So you don't have to rebuild it. Anyone who clones this repo gets instant access to:

- **Intent-based code search** — find code by _what it does_, not just by name
- **Dependency exploration** — trace upstream/downstream call chains
- **Semantic hierarchy** — understand the codebase architecture at a glance
- **AI-ready context** — any LLM-powered tool can use this graph to understand your code

## How do I use it?

### With an AI coding tool (MCP)

Add RPG-Encoder as an MCP server in your editor — no Rust or build tools required:

```json
{
	"mcpServers": {
		"rpg": {
			"command": "npx",
			"args": ["-y", "-p", "rpg-encoder", "rpg-mcp-server"]
		}
	}
}
```

### From the CLI

```bash
npm i -g rpg-encoder

rpg-encoder search "handle authentication"
rpg-encoder fetch "src/auth.rs:login"
rpg-encoder explore "src/auth.rs:login" --direction upstream
rpg-encoder info
```

### Keep it updated

After making code changes, run `rpg-encoder update` to incrementally sync the graph.

## Learn more

- **GitHub**: [github.com/userFRM/rpg-encoder](https://github.com/userFRM/rpg-encoder)
- **npm**: [npmjs.com/package/rpg-encoder](https://www.npmjs.com/package/rpg-encoder)
- **Paper**: [arXiv:2602.02084](https://arxiv.org/abs/2602.02084)
