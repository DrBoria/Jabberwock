import type { JSX } from "react"
import Link from "next/link"

export const PROVIDER_FAQS: { question: string; answer: string | JSX.Element }[] = [
	{
		question: "What are AI model providers?",
		answer: "AI model providers offer various language models with different capabilities and pricing.",
	},
	{
		question: "What is the Jabberwock Router?",
		answer: (
			<>
				<p>This is our very own model router, optimized to work seamlessly with Jabberwock Cloud.</p>
				<p>You don&apos;t have to use it to use Jabberwock, but it&apos;s the easiest way to do it.</p>
			</>
		),
	},
	{
		question: "Do I have to use the Jabberwock Router to use the Jabberwock products?",
		answer: "Not at all! You can bring your own provider key, no problem. This is just meant to make it easier.",
	},
	{
		question: "How is pricing calculated?",
		answer: "Pricing is based on token usage for input and output, measured per million tokens, like pretty much any other provider out there.",
	},
	{
		question: "How is my data treated?",
		answer: "The Jabberwock Router doesn't keep any of your data, the service only aims to make it easier to use Jabberwock. Each model vendor has their own privacy policy though, and usually free models use your data for training, so keep that in mind.",
	},
	{
		question: "How much does the Jabberwock Cloud service cost?",
		answer: (
			<>
				Our{" "}
				<Link href="/pricing" className="underline hover:no-underline">
					service pricing is here.
				</Link>
			</>
		),
	},
]
