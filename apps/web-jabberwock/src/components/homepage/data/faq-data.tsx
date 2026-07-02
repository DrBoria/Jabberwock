import Link from "next/link"

export interface FAQItem {
	question: string
	answer: React.ReactNode
}

export const faqs: FAQItem[] = [
	{
		question: "What exactly is Jabberwock?",
		answer: (
			<>
				Jabberwock is an open-source, AI-powered coding assistant that runs in VS Code. It goes beyond simple
				autocompletion by reading and writing across multiple files, executing commands, and adapting to your
				workflow—like having a whole dev team right inside your editor.
			</>
		),
	},
	{
		question: "How does Jabberwock differ from Copilot, Cursor, or Windsurf?",
		answer: (
			<>
				Jabberwock is <strong>open-source and fully customizable</strong>, letting you integrate any AI model
				you choose (e.g, OpenAI, Anthropic, local LLMs, etc.). It&apos;s built for{" "}
				<strong>multi-file edits</strong>, so it can read, refactor, and update multiple files at once for
				holistic code changes. Its <strong>agentic abilities</strong> go beyond a typical AI autocomplete,
				enabling it to run tests, open a browser, and handle deeper tasks. And you&apos;re always in control:
				Jabberwock is <strong>permission-based</strong>, meaning you can control and approve any file changes or
				command executions.
			</>
		),
	},
	{
		question: "Is Jabberwock really free?",
		answer: (
			<>
				Yes! Jabberwock is completely free and open-source. You&apos;ll only pay for the AI model usage if you
				use a paid API (like OpenAI). If you choose free or self-hosted models, there&apos;s no cost at all.
			</>
		),
	},
	{
		question: "Will my code stay private?",
		answer: (
			<>
				Yes. Because Jabberwock is an extension in your local VS Code, your code never leaves your machine
				unless you connect to an external AI API. Even then, you control exactly what is sent to the AI model.
				You can use tools like .jabberwockignore to exclude sensitive files, and you can also run Jabberwock
				with offline/local models for full privacy.
			</>
		),
	},
	{
		question: "Which AI models does Jabberwock support?",
		answer: (
			<>
				Jabberwock is fully model-agnostic, giving you the flexibility to work with whatever AI models you
				prefer. It supports OpenAI models (like GPT-4o, GPT-4, and o1), Anthropic&apos;s Claude (including
				Claude 3.5 Sonnet), Google&apos;s Gemini models, and local LLMs via APIs or specialized plugins. You can
				even connect any other model that follows Jabberwock&apos;s Model Context Protocol (MCP).
			</>
		),
	},
	{
		question: "Does Jabberwock support my programming language?",
		answer: (
			<>
				Likely yes! Jabberwock supports a wide range of languages—Python, Java, C#, JavaScript/TypeScript, Go,
				Rust, etc. Since it leverages the AI model&apos;s understanding, new or lesser-known languages may also
				work, depending on model support.
			</>
		),
	},
	{
		question: "How do I install and get started?",
		answer: (
			<>
				Install Jabberwock from the{" "}
				<a
					href="https://marketplace.visualstudio.com/items?itemName=RooVeterinaryInc.jabberwock"
					target="_blank"
					rel="noopener noreferrer"
					className="text-primary underline-offset-4 hover:underline">
					VS Code Marketplace
				</a>{" "}
				(or GitHub). Add your AI keys (OpenAI, Anthropic, or other) in the extension settings. Open the
				Jabberwock panel (the rocket icon) in VS Code, and start typing commands in plain English!{" "}
				<a
					href="https://docs.jabberwock.com/tutorial-videos"
					target="_blank"
					rel="noopener noreferrer"
					className="text-primary underline-offset-4 hover:underline">
					Watch our tutorial to help you get started.
				</a>
			</>
		),
	},
	{
		question: "Can it handle large, enterprise-scale projects?",
		answer: (
			<>
				Absolutely. Jabberwock uses efficient strategies (like partial-file analysis, summarization, or
				user-specified context) to handle large codebases. Enterprises especially appreciate the on-prem or
				self-hosted model option for compliance and security needs.{" "}
				<Link href="/enterprise" className="text-primary underline-offset-4 hover:underline">
					Learn more about Jabberwock for enterprise.
				</Link>
			</>
		),
	},
	{
		question: "Is it safe for enterprise use?",
		answer: (
			<>
				Yes. Jabberwock was built for enterprise environments. You can self-host AI models or use your own
				trusted provider. All file changes and commands go through permission gating, so nothing runs without
				your approval. And because Jabberwock is fully open-source, it&apos;s auditable—you can review exactly
				how it works before deploying it.{" "}
				<a
					href="https://jabberwock.com/enterprise"
					target="_blank"
					rel="noopener noreferrer"
					className="text-primary underline-offset-4 hover:underline">
					Learn more about Jabberwock for enterprise.
				</a>
			</>
		),
	},
	{
		question: "Can Jabberwock run commands and tests automatically?",
		answer: (
			<>
				Yes! One of Jabberwock&apos;s biggest strengths is its ability to execute commands—always optional and
				fully permission-based. It can run terminal commands like npm install, execute your test suites, and
				even open a web browser for integration testing when you approve it.
			</>
		),
	},
	{
		question: "What if I just want a casual coding 'vibe'?",
		answer: (
			<>
				Jabberwock shines for both serious enterprise development and casual &quot;vibe coding.&quot; You can
				ask it to quickly prototype ideas, refactor on the fly, or provide design suggestions—without a rigid,
				step-by-step process.
			</>
		),
	},
	{
		question: "Can I contribute to Jabberwock?",
		answer: (
			<>
				Yes, please do! Jabberwock is open-source on{" "}
				<a
					href="https://github.com/JabberwockInc/Jabberwock"
					target="_blank"
					rel="noopener noreferrer"
					className="text-primary underline-offset-4 hover:underline">
					GitHub
				</a>
				. Submit issues, suggest features, or open a pull request. There&apos;s also an active community on{" "}
				<a
					href="https://discord.gg/jabberwock"
					target="_blank"
					rel="noopener noreferrer"
					className="text-primary underline-offset-4 hover:underline">
					Discord
				</a>{" "}
				and{" "}
				<a
					href="https://reddit.com/r/Jabberwock"
					target="_blank"
					rel="noopener noreferrer"
					className="text-primary underline-offset-4 hover:underline">
					Reddit
				</a>
				. You can also check out our{" "}
				<a
					href="https://www.youtube.com/@JabberwockYT"
					target="_blank"
					rel="noopener noreferrer"
					className="text-primary underline-offset-4 hover:underline">
					YouTube
				</a>{" "}
				tutorials and{" "}
				<a
					href="https://blog.jabberwock.com"
					target="_blank"
					rel="noopener noreferrer"
					className="text-primary underline-offset-4 hover:underline">
					blog posts
				</a>{" "}
				from fellow developers showcasing real-world usage.
			</>
		),
	},
]
