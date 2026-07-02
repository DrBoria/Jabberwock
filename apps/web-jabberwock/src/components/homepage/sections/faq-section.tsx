"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { faqs } from "../data/faq-data"
import type { FAQItem } from "../data/faq-data"

export function FAQSection({ faqs: externalFaqs }: { faqs?: FAQItem[] }) {
	const items = externalFaqs ?? faqs
	const [openIndex, setOpenIndex] = useState<number | null>(null)

	const toggleFAQ = (index: number) => {
		setOpenIndex(openIndex === index ? null : index)
	}

	return (
		<section id="faq-section" className="border-t border-border py-20">
			<div className="container mx-auto px-4 sm:px-6 lg:px-8">
				<div className="mx-auto mb-24 max-w-3xl text-center">
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{
							duration: 0.6,
							ease: [0.21, 0.45, 0.27, 0.9],
						}}>
						<h2 className="text-4xl font-bold tracking-tight sm:text-5xl">Frequently Asked Questions</h2>
						<p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
							Everything you need to know about Jabberwock and how it can transform your development
							workflow.
						</p>
					</motion.div>
				</div>

				<div className="mx-auto max-w-3xl">
					<div className="space-y-4">
						{items.map((faq, index) => (
							<motion.div
								key={index}
								initial={{ opacity: 0, y: 20 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true }}
								transition={{
									duration: 0.5,
									delay: index * 0.1,
									ease: [0.21, 0.45, 0.27, 0.9],
								}}>
								<div className="group relative rounded-lg border border-border/50 bg-background/30 backdrop-blur-xl transition-all duration-300 hover:border-border">
									<button
										onClick={() => toggleFAQ(index)}
										className="flex w-full items-center justify-between p-6 text-left"
										aria-expanded={openIndex === index}>
										<h3 className="text-lg font-medium text-foreground/90">{faq.question}</h3>
										<ChevronDown
											className={cn(
												"h-5 w-5 text-muted-foreground transition-transform duration-200",
												openIndex === index ? "rotate-180" : "",
											)}
										/>
									</button>
									<div
										className={cn(
											"overflow-hidden transition-all duration-300 ease-in-out",
											openIndex === index ? "max-h-96 pb-6" : "max-h-0",
										)}>
										<div className="px-6 text-muted-foreground">{faq.answer}</div>
									</div>
								</div>
							</motion.div>
						))}
					</div>
				</div>
			</div>
		</section>
	)
}
