export type TableRow = { category: string; examples: string; source: string }

export const INFO_TABLE_ROWS: TableRow[] = [
	{ category: "Account Information", examples: "Name, email, organization, auth tokens", source: "You" },
	{
		category: "Workspace Configuration",
		examples: "Org settings, allow\u2011lists, rules files, modes, dashboards",
		source: "You / Extension (when signed in)",
	},
	{
		category: "Prompts, Chat Snippets & Token Counts",
		examples: "Text prompts, model outputs, token counts",
		source: "Extension (when signed in)",
	},
	{
		category: "Usage Data",
		examples: "Feature clicks, error logs, performance metrics (captured via PostHog)",
		source: "Services automatically (PostHog)",
	},
	{
		category: "Payment Data",
		examples: "Tokenized card details, billing address, invoices",
		source: "Payment processor (Stripe)",
	},
	{
		category: "Marketing Data",
		examples:
			"Cookies, IP address, browser type, page views, voluntary form submissions (e.g., newsletter or wait\u2011list sign\u2011ups)",
		source: "Marketing Site automatically / You",
	},
]

export type DataFlowRow = { data: string; sentTo: string; notSentTo: string }

export const DATA_FLOW_ROWS: DataFlowRow[] = [
	{
		data: "Code & files you work on",
		sentTo: "Your chosen model provider (direct client \u2192 provider TLS), or Jabberwock (proxy mode; transit\u2011only) when you select Jabberwock as the provider",
		notSentTo:
			"Jabberwock servers (except proxy mode; transit\u2011only, no storage); ad networks; model\u2011training pipelines",
	},
	{
		data: "Prompts, chat snippets & token counts (Cloud)",
		sentTo: "Jabberwock Cloud (encrypted at rest)",
		notSentTo: "Any third\u2011party",
	},
	{ data: "Workspace Configuration", sentTo: "Jabberwock Cloud (encrypted at rest)", notSentTo: "Any third-party" },
	{
		data: "Usage & Telemetry",
		sentTo: "PostHog (self\u2011hosted analytics platform)",
		notSentTo: "Ad networks or data brokers",
	},
	{
		data: "Payment Data",
		sentTo: "Stripe (PCI\u2011DSS Level 1)",
		notSentTo: "Jabberwock servers (we store only the Stripe customer ID)",
	},
]
