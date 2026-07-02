import { ContactForm } from "@/components/enterprise/contact-form"
import { CTA_CARDS } from "./data"

export function EnterpriseCtaSection() {
	return (
		<section id="contact" className="relative overflow-hidden py-20 sm:py-24">
			<div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-cyan-500/5 to-purple-500/5 dark:from-blue-500/10 dark:via-cyan-500/10 dark:to-purple-500/10" />
			<div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-4xl">
					<div className="relative rounded-3xl border border-border/50 bg-gradient-to-br from-blue-500/5 via-cyan-500/5 to-purple-500/5 p-8 shadow-2xl backdrop-blur-xl dark:border-white/20 dark:bg-gradient-to-br dark:from-gray-800 dark:via-gray-900 dark:to-black dark:shadow-[0_30px_90px_rgba(255,255,255,0.15)] sm:p-12">
						<div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 dark:bg-gradient-to-br dark:from-white/[0.05] dark:via-transparent dark:to-white/[0.03]" />
						<div className="relative text-center">
							<h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
								Ready to Transform Your Development Process?
							</h2>
							<p className="mb-8 text-lg text-muted-foreground">
								Join our early access program and be among the first to experience the power of
								Jabberwock Code Cloud for Enterprise.
							</p>
							<div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
								{CTA_CARDS.map((cta) => (
									<div
										key={cta.title}
										className="rounded-lg border border-border bg-card/80 backdrop-blur-sm p-6 text-center shadow-lg hover:shadow-xl transition-all duration-300 dark:border-white/20 dark:bg-gray-800/80 dark:hover:border-white/40 dark:hover:bg-gray-700/90 dark:hover:shadow-[0_20px_50px_rgba(255,255,255,0.2)] dark:hover:scale-[1.02]">
										<h3 className="mb-2 text-xl font-bold">{cta.title}</h3>
										<p className="mb-4 text-muted-foreground">{cta.desc}</p>
										<ContactForm
											formType={cta.formType}
											buttonText={cta.buttonText}
											buttonClassName="bg-black text-white hover:bg-gray-800 hover:shadow-lg hover:shadow-black/20 dark:bg-white dark:text-black dark:hover:bg-gray-200 dark:hover:shadow-white/20 transition-all duration-300"
										/>
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
