export type SettingsIntents =
	// ── Settings — Core ─────────────────────────────────────────────
	| { type: "settings.update"; payload: { updatedSettings: Record<string, unknown> } }
	| { type: "settings.announcement.shown"; payload: Record<string, never> }
	| { type: "settings.upsells.dismissed.get"; payload: Record<string, never> }
	| { type: "settings.upsell.dismiss"; payload: { upsellId: string } }
	| { type: "settings.keyboard.shortcuts.open"; payload: { text?: string } }
	| { type: "settings.markdown.preview.open"; payload: { text: string } }
	| { type: "settings.telemetry.set"; payload: { text: string } }
	| { type: "settings.terminal.operation.action"; payload: { terminalOperation: unknown } }
	| { type: "settings.mdm.auth.notification"; payload: Record<string, never> }
	| { type: "settings.commands.allowed.set"; payload: { commands: string[] } }
	| { type: "settings.commands.denied.set"; payload: { commands: string[] } }
	| { type: "settings.commands.file.open"; payload: { text: string } }
	| { type: "settings.commands.delete"; payload: { text: string; values?: { source: string } } }
	| { type: "settings.commands.create"; payload: { text: string; values: { source: string } } }
	| { type: "settings.textarea.text.insert"; payload: { text: string } }
	| { type: "settings.openai.codex.rate.limits"; payload: Record<string, never> }
	| { type: "settings.debug.api.history.open"; payload: Record<string, never> }
	| { type: "settings.debug.ui.history.open"; payload: Record<string, never> }
	| { type: "settings.diagnostics.download"; payload: { values: unknown } }
	// ── Settings — API Config ───────────────────────────────────────
	| { type: "settings.api.config.save"; payload: { text: string; apiConfiguration: Record<string, unknown> } }
	| { type: "settings.api.config.upsert"; payload: { text: string; apiConfiguration: Record<string, unknown> } }
	| {
			type: "settings.api.config.rename"
			payload: {
				text: string
				values: { oldName: string; newName: string }
				apiConfiguration: Record<string, unknown>
			}
	  }
	| { type: "settings.api.config.delete"; payload: { text: string } }
	| { type: "settings.api.config.load"; payload: { text: string } }
	| { type: "settings.api.config.load.by.id"; payload: { text: string } }
	| { type: "settings.api.config.list"; payload: Record<string, never> }
	| { type: "settings.api.config.lock.modes"; payload: { bool: boolean } }
	| { type: "settings.api.config.pin.toggle"; payload: { text: string } }
	| { type: "settings.api.config.enhancement.id"; payload: { text: string } }
	| { type: "settings.api.config.password.set"; payload: Record<string, never> }
	// ── Settings — Code Index ───────────────────────────────────────
	| { type: "settings.code.index.save"; payload: { codeIndexSettings: Record<string, unknown> } }
	| { type: "settings.code.index.status"; payload: Record<string, never> }
	| { type: "settings.code.index.secret.status"; payload: Record<string, never> }
	| { type: "settings.code.index.start"; payload: Record<string, never> }
	| { type: "settings.code.index.stop"; payload: Record<string, never> }
	| { type: "settings.code.index.workspace.toggle"; payload: { bool: boolean } }
	| { type: "settings.code.index.auto.enable"; payload: { bool: boolean } }
	| { type: "settings.code.index.clear"; payload: Record<string, never> }
	// ── Settings — Files ────────────────────────────────────────────
	| { type: "settings.file.image.open"; payload: { text: string; values?: Record<string, unknown> } }
	| { type: "settings.file.image.save"; payload: { dataUri: string } }
	| {
			type: "settings.file.open"
			payload: { text: string; values?: { create?: boolean; content?: string; line?: number } }
	  }
	| { type: "settings.file.content.read"; payload: { text: string } }
	| { type: "settings.file.external.open"; payload: { url: string } }
	| { type: "settings.file.mention.open"; payload: { text: string } }
	// ── Settings — MCP ──────────────────────────────────────────────
	| { type: "settings.mcp.settings.open"; payload: Record<string, never> }
	| { type: "settings.mcp.project.settings.open"; payload: Record<string, never> }
	| { type: "settings.mcp.server.delete"; payload: { serverName: string; source: string } }
	| { type: "settings.mcp.server.restart"; payload: { text: string; source: string } }
	| {
			type: "settings.mcp.tool.always.allow"
			payload: { serverName: string; source: string; toolName: string; alwaysAllow: boolean }
	  }
	| {
			type: "settings.mcp.tool.enabled.for.prompt"
			payload: { serverName: string; source: string; toolName: string; isEnabled: boolean }
	  }
	| { type: "settings.mcp.server.toggle"; payload: { serverName: string; disabled: boolean; source: string } }
	| { type: "settings.mcp.timeout.update"; payload: { serverName: string; value: number; source: string } }
	| { type: "settings.mcp.servers.refresh"; payload: Record<string, never> }
	// ── Settings — Agents / Modes ───────────────────────────────────
	| { type: "settings.mode.custom.update"; payload: { modeConfig: Record<string, unknown> } }
	| { type: "settings.mode.custom.delete"; payload: { slug: string; checkOnly?: boolean } }
	| { type: "settings.mode.export"; payload: { slug: string } }
	| { type: "settings.mode.import"; payload: { source: string } }
	| { type: "settings.mode.rules.directory.check"; payload: { slug: string } }
	| { type: "settings.mode.selector.opened"; payload: { bool: boolean } }
	| { type: "settings.modes.request"; payload: Record<string, never> }
	| { type: "settings.mode.custom.settings.open"; payload: Record<string, never> }
	// ── Settings — Models ───────────────────────────────────────────
	| {
			type: "settings.models.router.request"
			payload: {
				values?: { provider?: string; refresh?: boolean; litellmApiKey?: string; litellmBaseUrl?: string }
			}
	  }
	| {
			type: "settings.models.openai.request"
			payload: { values: { baseUrl: string; apiKey: string; openAiHeaders?: Record<string, string> } }
	  }
	| { type: "settings.models.ollama.request"; payload: Record<string, never> }
	| { type: "settings.models.lmstudio.request"; payload: Record<string, never> }
	| { type: "settings.models.roo.request"; payload: Record<string, never> }
	| { type: "settings.models.roo.credit.balance"; payload: { requestId?: string } }
	| { type: "settings.models.vscode.lm.request"; payload: Record<string, never> }
	| { type: "settings.models.router.flush"; payload: { text: string } }
	// ── Settings — Context / Prompts ────────────────────────────────
	| { type: "settings.prompt.update"; payload: { promptMode: string; customPrompt: Record<string, unknown> } }
	| {
			type: "settings.prompt.system.template.update"
			payload: { systemPromptTemplateKey: string; systemPromptTemplate?: string }
	  }
	| { type: "settings.prompt.system.get"; payload: { mode?: string } }
	| { type: "settings.prompt.system.copy"; payload: { mode?: string } }
	| { type: "settings.instructions.custom.update"; payload: { text: string } }
	// ── Settings — VSCode ───────────────────────────────────────────
	| { type: "settings.vscode.setting.update"; payload: { setting: string; value: unknown } }
	| { type: "settings.vscode.setting.get"; payload: { setting: string } }
	| { type: "settings.auto.approval.enabled"; payload: { bool: boolean } }
	| { type: "settings.debug.setting"; payload: { bool: boolean } }
	// ── Settings — Webview / Devtool ────────────────────────────────
	| { type: "settings.devtool.status"; payload: Record<string, never> }
	| { type: "settings.webview.log"; payload: { text: string } }
	| { type: "settings.webview.dom.response"; payload: { requestId: string; text: string } }
	| { type: "settings.webview.error"; payload: { text: string } }
	| { type: "settings.webview.url.fetch"; payload: { url: string; requestId: string } }
	| {
			type: "settings.locator.file.open"
			payload: { locatorPayload: { filePath: string; line: number; column: number } }
	  }
	| { type: "settings.locator.target.set"; payload: { text: string } }
	// ── Settings — Worktree ─────────────────────────────────────────
	| { type: "settings.worktree.list"; payload: Record<string, never> }
	| {
			type: "settings.worktree.create"
			payload: {
				worktreePath: string
				worktreeBranch?: string
				worktreeBaseBranch?: string
				worktreeCreateNewBranch?: boolean
			}
	  }
	| { type: "settings.worktree.delete"; payload: { worktreePath: string; worktreeForce?: boolean } }
	| { type: "settings.worktree.switch"; payload: { worktreePath: string; worktreeNewWindow?: boolean } }
	| { type: "settings.worktree.branches.available"; payload: Record<string, never> }
	| { type: "settings.worktree.defaults"; payload: Record<string, never> }
	| { type: "settings.worktree.include.status"; payload: Record<string, never> }
	| { type: "settings.worktree.branch.include.check"; payload: { worktreeBranch: string } }
	| { type: "settings.worktree.include.create"; payload: { worktreeIncludeContent: string } }
	| { type: "settings.worktree.branch.checkout"; payload: { worktreeBranch: string } }
	| { type: "settings.worktree.path.browse"; payload: Record<string, never> }
	// ── Settings — Skills ───────────────────────────────────────────
	| { type: "settings.skills.request"; payload: Record<string, never> }
	| {
			type: "settings.skill.create"
			payload: {
				skillName: string
				source: string
				skillDescription: string
				skillMode?: string
				skillModeSlugs?: string[]
			}
	  }
	| {
			type: "settings.skill.delete"
			payload: { skillName: string; source: string; skillMode?: string; skillModeSlugs?: string[] }
	  }
	| {
			type: "settings.skill.move"
			payload: { skillName: string; source: string; skillMode?: string; newSkillMode?: string }
	  }
	| {
			type: "settings.skill.modes.update"
			payload: { skillName: string; source: string; newSkillModeSlugs?: string[] }
	  }
	| { type: "settings.skill.file.open"; payload: { skillName: string; source: string } }
