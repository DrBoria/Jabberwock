import type { LucideIcon } from "lucide-react"
import { Pointer, Slack, Github, Code, GitPullRequest, Wrench, Map, MessageCircleQuestionMark } from "lucide-react"

export interface UseCase {
	role: string
	use: string
	agent: UseCaseAgent
	context: UseCaseSource
}

export interface UseCaseSource {
	name: string
	icon: LucideIcon
}

export interface UseCaseAgent {
	name: string
	icon: LucideIcon
}

export const SOURCES = {
	slack: { name: "Slack", icon: Slack },
	web: { name: "Web", icon: Pointer },
	github: { name: "GitHub", icon: Github },
	extension: { name: "Extension", icon: Code },
}

export const AGENTS = {
	explainer: { name: "Explainer", icon: MessageCircleQuestionMark },
	planner: { name: "Planner", icon: Map },
	coder: { name: "Coder", icon: Code },
	reviewer: { name: "Reviewer", icon: GitPullRequest },
	fixer: { name: "Fixer", icon: Wrench },
}

export const USE_CASES: UseCase[] = [
	{
		role: "Frontend Developer",
		use: "Take Lisa's feedback above and incorporate it into the landing page.",
		agent: AGENTS.coder,
		context: SOURCES.slack,
	},
	{
		role: "Customer Success",
		use: "What could be causing this bug as described by the customer?",
		agent: AGENTS.explainer,
		context: SOURCES.web,
	},
	{
		role: "Backend Engineer",
		use: "Create a migration denormalizing total_cost calculation and backfill the remainder.",
		agent: AGENTS.coder,
		context: SOURCES.extension,
	},
	{
		role: "Security Engineer",
		use: "Do we use any of the libraries mentioned in the thread?",
		agent: AGENTS.explainer,
		context: SOURCES.slack,
	},
	{
		role: "Designer",
		use: "Refactor the button component to use CSS variables",
		agent: AGENTS.coder,
		context: SOURCES.slack,
	},
	{
		role: "Product Manager",
		use: "How big of a change would it be to turn this from a yes/no to have 4 options?",
		agent: AGENTS.coder,
		context: SOURCES.web,
	},
	{
		role: "QA Engineer",
		use: "Write a Playwright test for the login flow failure case, extract existing mocks into shared.",
		agent: AGENTS.coder,
		context: SOURCES.github,
	},
	{
		role: "DevOps Engineer",
		use: "Update the Dockerfile to use Node 20 Alpine.",
		agent: AGENTS.fixer,
		context: SOURCES.slack,
	},
	{
		role: "Mobile Developer",
		use: "Copy what we did in PR #4253 and apply to this component.",
		agent: AGENTS.coder,
		context: SOURCES.slack,
	},
	{
		role: "Technical Writer",
		use: "Generate JSDoc comments for the auth utility functions.",
		agent: AGENTS.coder,
		context: SOURCES.github,
	},
	{
		role: "Junior Developer",
		use: "Review this pull request for potential performance improvements.",
		agent: AGENTS.reviewer,
		context: SOURCES.github,
	},
	{
		role: "Engineering Manager",
		use: "Break down this user profile feature into technical tasks, grouped by skill.",
		agent: AGENTS.planner,
		context: SOURCES.web,
	},
	{
		role: "Support Engineer",
		use: "What's causing this stack trace? The customer is on macOS 26.1.",
		agent: AGENTS.explainer,
		context: SOURCES.web,
	},
	{
		role: "Frontend Developer",
		use: "Make the navigation menu responsive on mobile devices.",
		agent: AGENTS.coder,
		context: SOURCES.web,
	},
	{
		role: "Backend Engineer",
		use: "Give me two architecture options for the notification system in this PRD.",
		agent: AGENTS.planner,
		context: SOURCES.web,
	},
	{
		role: "Designer",
		use: "Implement the loading spinner animation in CSS.",
		agent: AGENTS.coder,
		context: SOURCES.web,
	},
	{
		role: "Customer Success",
		use: "Write a script to find patterns in these CPU load logs.",
		agent: AGENTS.coder,
		context: SOURCES.slack,
	},
	{
		role: "Full Stack Dev",
		use: "Refactor user_preferences to use named columns instead of a single JSON blob",
		agent: AGENTS.coder,
		context: SOURCES.extension,
	},
	{
		role: "QA Engineer",
		use: "Automate the regression suite for the checkout process.",
		agent: AGENTS.coder,
		context: SOURCES.extension,
	},
	{
		role: "DevOps Engineer",
		use: "Understand why this build error only happens in prod and fix it.",
		agent: AGENTS.coder,
		context: SOURCES.extension,
	},
	{
		role: "Product Marketer",
		use: "What were the 5 most significant PRs merged in the past week?",
		agent: AGENTS.explainer,
		context: SOURCES.slack,
	},
	{
		role: "Junior Developer",
		use: "Explain how useEffect dependency arrays work here.",
		agent: AGENTS.explainer,
		context: SOURCES.extension,
	},
	{
		role: "Senior Engineer",
		use: "Check if this implementation follows the Single Responsibility Principle.",
		agent: AGENTS.reviewer,
		context: SOURCES.github,
	},
]
