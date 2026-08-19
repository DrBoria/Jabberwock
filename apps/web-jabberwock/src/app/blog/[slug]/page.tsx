import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, ChevronRight, Clock } from "lucide-react"
import {
	getBlogPostBySlug,
	getAdjacentPosts,
	formatPostDatePt,
	calculateReadingTime,
	formatReadingTime,
} from "@/lib/blog"
import { BlogPostAnalytics } from "@/components/blog/BlogAnalytics"
import { BlogContent } from "@/components/blog/BlogContent"
import { BlogFAQ } from "@/components/blog/BlogFAQ"
import { BlogPostCTA } from "@/components/blog/BlogPostCTA"
import { parseFAQFromMarkdown } from "./blog-faq-utils"
import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { BlogPostSchema } from "./blog-post-schemas"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface Props {
	params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params
	const post = getBlogPostBySlug(slug)

	if (!post) {
		return {}
	}

	const path = `/blog/${post.slug}`

	return {
		title: post.title,
		description: post.description,
		alternates: {
			canonical: `${SEO.url}${path}`,
		},
		openGraph: {
			title: post.title,
			description: post.description,
			url: `${SEO.url}${path}`,
			siteName: SEO.name,
			images: [
				{
					url: ogImageUrl(post.title, post.description),
					width: 1200,
					height: 630,
					alt: post.title,
				},
			],
			locale: SEO.locale,
			type: "article",
			publishedTime: post.publish_date,
		},
		twitter: {
			card: SEO.twitterCard,
			title: post.title,
			description: post.description,
			images: [ogImageUrl(post.title, post.description)],
		},
		keywords: [...SEO.keywords, ...post.tags],
	}
}

export default async function BlogPostPage({ params }: Props) {
	const { slug } = await params
	const post = getBlogPostBySlug(slug)

	if (!post) {
		notFound()
	}

	const { previous, next } = getAdjacentPosts(slug)
	const readingTime = calculateReadingTime(post.content)
	const readingTimeDisplay = formatReadingTime(readingTime)
	const { faqItems, contentWithoutFAQ } = parseFAQFromMarkdown(post.content)

	return (
		<>
			<BlogPostSchema post={post} faqItems={faqItems} />

			<BlogPostAnalytics post={post} />

			<article className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-4xl">
					<nav aria-label="Breadcrumb" className="mb-8">
						<ol className="flex items-center gap-1 text-sm text-muted-foreground">
							<li>
								<Link href="/blog" className="transition-colors hover:text-foreground">
									Blog
								</Link>
							</li>
							<li>
								<ChevronRight className="h-4 w-4" />
							</li>
							<li className="truncate text-foreground" aria-current="page">
								{post.title}
							</li>
						</ol>
					</nav>

					<div className="prose prose-lg dark:prose-invert">
						<header className="not-prose mb-8">
							<h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">{post.title}</h1>
							<div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
								<span>{formatPostDatePt(post.publish_date)}</span>
								<span className="text-border">•</span>
								<span className="flex items-center gap-1">
									<Clock className="h-4 w-4" />
									{readingTimeDisplay}
								</span>
							</div>
							{post.tags.length > 0 && (
								<div className="mt-4 flex flex-wrap gap-2">
									{post.tags.map((tag) => (
										<span
											key={tag}
											className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
											{tag}
										</span>
									))}
								</div>
							)}
						</header>

						<BlogContent content={contentWithoutFAQ} />
						{faqItems.length > 0 && <BlogFAQ items={faqItems} />}
						<BlogPostCTA />
					</div>

					{(previous || next) && (
						<nav aria-label="Post navigation" className="mt-12 border-t border-border pt-8">
							<div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
								{previous ? (
									<Link
										href={`/blog/${previous.slug}`}
										className="group flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
										<ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
										<div className="flex flex-col">
											<span className="text-xs uppercase tracking-wide">Previous</span>
											<span className="font-medium text-foreground">{previous.title}</span>
										</div>
									</Link>
								) : (
									<div />
								)}
								{next ? (
									<Link
										href={`/blog/${next.slug}`}
										className="group flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:flex-row-reverse sm:text-right">
										<ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
										<div className="flex flex-col">
											<span className="text-xs uppercase tracking-wide">Next</span>
											<span className="font-medium text-foreground">{next.title}</span>
										</div>
									</Link>
								) : (
									<div />
								)}
							</div>
						</nav>
					)}
				</div>
			</article>
		</>
	)
}
