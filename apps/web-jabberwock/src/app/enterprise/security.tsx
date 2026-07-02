import { ArrowRight, CheckCircle, Lock, Shield } from "lucide-react"

import { Button } from "@/components/ui"
import { EXTERNAL_LINKS } from "@/lib/constants"

export function EnterpriseSecurity() {
	return (
		<section className="py-16">
			<div className="container mx-auto px-4 sm:px-6 lg:px-8">
				<div className="rounded-lg border border-border bg-card p-8 shadow-sm">
					<div className="grid gap-8 md:grid-cols-2 md:items-center">
						<div>
							<div className="mb-5 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-2.5 dark:from-blue-500/20 dark:to-cyan-500/20">
								<div className="rounded-lg bg-gradient-to-r from-blue-500/80 to-cyan-500/80 p-2.5">
									<Shield className="h-6 w-6 text-white" />
								</div>
							</div>
							<h3 className="mb-4 text-2xl font-bold">Enterprise-Grade Security</h3>
							<p className="mb-6 text-muted-foreground">
								Built with security-first principles to meet stringent enterprise requirements while
								maintaining developer productivity.
							</p>
							<ul className="space-y-3">
								<li className="flex items-center space-x-3">
									<CheckCircle className="h-5 w-5 text-green-500" />
									<span>SOC 2 Type I Certified with Type II in observation</span>
								</li>
								<li className="flex items-center space-x-3">
									<CheckCircle className="h-5 w-5 text-green-500" />
									<span>End-to-end encryption for all data transmission</span>
								</li>
								<li className="flex items-center space-x-3">
									<CheckCircle className="h-5 w-5 text-green-500" />
									<span>Security-first architecture with explicit permissions</span>
								</li>
								<li className="flex items-center space-x-3">
									<CheckCircle className="h-5 w-5 text-green-500" />
									<span>Complete audit trails and compliance reporting</span>
								</li>
								<li className="flex items-center space-x-3">
									<CheckCircle className="h-5 w-5 text-green-500" />
									<span>Open-source transparency for security verification</span>
								</li>
							</ul>
						</div>
						<div className="flex flex-col items-center justify-center">
							<div className="rounded-lg border border-border bg-secondary/50 p-6 text-center">
								<div className="mb-4 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-2.5 dark:from-blue-500/20 dark:to-cyan-500/20">
									<div className="rounded-lg bg-gradient-to-r from-blue-500/80 to-cyan-500/80 p-2.5">
										<Lock className="h-8 w-8 text-white" />
									</div>
								</div>
								<h4 className="mb-2 text-lg font-semibold">Security-First Design</h4>
								<p className="mb-4 text-sm text-muted-foreground">
									Every feature built with enterprise security requirements in mind
								</p>
								<Button
									size="lg"
									asChild
									className="bg-black text-white hover:bg-gray-800 hover:shadow-lg hover:shadow-black/20 dark:bg-white dark:text-black dark:hover:bg-gray-200 dark:hover:shadow-white/20 transition-all duration-300">
									<a
										href={EXTERNAL_LINKS.SECURITY}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center">
										View Security Details
										<ArrowRight className="ml-2 h-4 w-4" />
									</a>
								</Button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
