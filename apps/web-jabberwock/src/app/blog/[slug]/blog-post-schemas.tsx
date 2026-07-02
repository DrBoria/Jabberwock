import Script from "next/script"

import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"

interface BlogPostSchemaProps {
	post: { title: string; description: string; slug: string; publish_date: string; content: string }
	faqItems: { question: string; answer: string }[]
}

export function BlogPostSchema({ post, faqItems }: BlogPostSchemaProps) {
	const articleSchema = {
		"@context": "https://schema.org",
		"@type": "BlogPosting",
		headline: post.title,
		description: post.description,
		datePublished: post.publish_date,
		image: ogImageUrl(post.title, post.description),
		wordCount: post.content.split(/\s+/).filter(Boolean).length,
		mainEntityOfPage: { "@type": "WebPage", "@id": `${SEO.url}/blog/${post.slug}` },
		url: `${SEO.url}/blog/${post.slug}`,
		author: { "@type": "Organization", "@id": `${SEO.url}#org`, name: SEO.name },
		publisher: {
			"@type": "Organization",
			"@id": `${SEO.url}#org`,
			name: SEO.name,
			logo: { "@type": "ImageObject", url: `${SEO.url}/android-chrome-512x512.png` },
		},
	}

	const breadcrumbSchema = {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: [
			{ "@type": "ListItem", position: 1, name: "Home", item: SEO.url },
			{ "@type": "ListItem", position: 2, name: "Blog", item: `${SEO.url}/blog` },
			{ "@type": "ListItem", position: 3, name: post.title, item: `${SEO.url}/blog/${post.slug}` },
		],
	}

	const hasFAQ = faqItems.length > 0

	const faqSchema = hasFAQ
		? {
				"@context": "https://schema.org",
				"@type": "FAQPage",
				mainEntity: faqItems.map((item) => ({
					"@type": "Question",
					name: item.question,
					acceptedAnswer: { "@type": "Answer", text: item.answer },
				})),
			}
		: null

	return (
		<>
			<Script
				id="article-schema"
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
			/>
			<Script
				id="breadcrumb-schema"
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
			/>
			{faqSchema && (
				<Script
					id="faq-schema"
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
				/>
			)}
		</>
	)
}
