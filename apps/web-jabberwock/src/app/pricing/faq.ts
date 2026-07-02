interface FaqItem {
	q: string
	a: string | null
}

export const FAQ_ITEMS: FaqItem[] = [
	{
		q: "Wait, is Jabberwock free or not?",
		a: "Yes! The Jabberwock VS Code extension is open source and free forever. The extension acts as a powerful AI coding assistant right in your editor. These are the prices for Jabberwock Code Cloud.",
	},
	{
		q: "Is there a free trial?",
		a: "Yes, all paid plans come with a 14-day free trial to try out functionality. To use Cloud Agents, you can buy credits.",
	},
	{ q: "How do credits work?", a: null },
	{
		q: "Do I need a credit card for the free trial?",
		a: "Yes, but you won\u2019t be charged until your trial ends, except for credit purchases. You can cancel anytime with one click.",
	},
	{
		q: "What payment methods do you accept?",
		a: "We accept all major credit cards, debit cards, and can arrange invoice billing for Enterprise customers.",
	},
	{
		q: "Can I cancel or change plans?",
		a: "Yes, you can upgrade, downgrade or cancel your plan at any time. Changes will be reflected in your next billing cycle.",
	},
	{
		q: "What if I have enterprise-level needs like SAML/SCIM, large-scale deployments, specific integrations and custom terms?",
		a: null,
	},
]
