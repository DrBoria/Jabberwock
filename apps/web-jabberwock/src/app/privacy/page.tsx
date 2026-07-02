import { INFO_TABLE_ROWS, DATA_FLOW_ROWS } from "./data"
import { privacyMetadata } from "./meta"
import { PrivacyFooterSections } from "./sections"

export const metadata = privacyMetadata

export default function Privacy() {
	return (
		<>
			<div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
				<div className="prose prose-lg mx-auto max-w-4xl dark:prose-invert">
					<h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
						Jabberwock Cloud Privacy Policy
					</h1>
					<p className="text-muted-foreground">Last Updated: September 19, 2025</p>

					<p className="lead">
						This Privacy Policy explains how Jabberwock, Inc. (&ldquo;Jabberwock,&rdquo; &ldquo;we,&rdquo;
						&ldquo;our,&rdquo; or &ldquo;us&rdquo;) collects, uses, and shares information when you:
					</p>
					<ul className="lead">
						<li>
							browse any page under <strong>jabberwock.com</strong> (the <em>Marketing Site</em>); and/or
						</li>
						<li>
							create an account for, sign in to, or otherwise use <strong>Jabberwock Cloud</strong> at{" "}
							<strong>app.jabberwock.com</strong> or through the Jabberwock extension while authenticated
							to that Cloud account (the <em>Cloud Service</em>).
						</li>
					</ul>

					<div className="my-8 rounded-lg border border-border bg-muted/50 p-6">
						<h3 className="mt-0 text-lg font-semibold">Extension&#8208;Only Usage</h3>
						<p className="mb-0">
							If you run the Jabberwock extension <strong>without</strong> connecting to a Cloud account,
							your data is governed by the standalone{" "}
							<a
								href="https://github.com/JabberwockInc/Jabberwock/blob/main/PRIVACY.md"
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary hover:underline">
								Jabberwock Extension Privacy Policy
							</a>
							.
						</p>
					</div>

					<h2 className="mt-12 text-2xl font-bold">Quick Summary</h2>
					<ul>
						<li>
							<strong>
								Your source code does not transit Jabberwock servers unless you explicitly choose
								Jabberwock as a model provider (proxy mode).
							</strong>{" "}
							When Jabberwock Cloud is your model provider, your code briefly transits Jabberwock servers
							only to forward it to the upstream model, is not stored, and is deleted immediately after
							forwarding. Otherwise, your code is sent <strong>directly</strong>&#8208;via
							client&#8208;to&#8208;provider TLS&#8208;to the model you select. Jabberwock never stores,
							inspects, or trains on your code.
						</li>
						<li>
							<strong>Prompts and chat snippets are collected by default</strong> in Jabberwock Cloud so
							you can search and re&#8208;use past conversations. Organization admins can disable this
							collection at any time.
						</li>
						<li>
							We collect only the data needed to operate Jabberwock Cloud, do <strong>not</strong> sell
							customer data, and do <strong>not</strong> use your content to train models.
						</li>
					</ul>

					<h2 className="mt-12 text-2xl font-bold">1. Information We Collect</h2>
					<div className="overflow-x-auto">
						<table className="min-w-full border-collapse border border-border">
							<thead>
								<tr className="bg-muted/50">
									<th className="border border-border px-4 py-2 text-left font-semibold">Category</th>
									<th className="border border-border px-4 py-2 text-left font-semibold">Examples</th>
									<th className="border border-border px-4 py-2 text-left font-semibold">Source</th>
								</tr>
							</thead>
							<tbody>
								{INFO_TABLE_ROWS.map((row, i) => (
									<tr key={i} className={i % 2 === 1 ? "bg-muted/25" : ""}>
										<td className="border border-border px-4 py-2 font-medium">{row.category}</td>
										<td className="border border-border px-4 py-2">{row.examples}</td>
										<td className="border border-border px-4 py-2">{row.source}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					<h2 className="mt-12 text-2xl font-bold">2. How We Use Information</h2>
					<ul>
						<li>
							<strong>Operate & secure Jabberwock Cloud</strong> (authentication, completions, abuse
							prevention)
						</li>
						<li>
							<strong>Provide support & improve features</strong> (debugging, analytics, product
							decisions)
						</li>
						<li>
							<strong>Process payments & manage subscriptions</strong>
						</li>
						<li>
							<strong>Send product updates and roadmap communications</strong> (opt&#8208;out available)
						</li>
						<li>
							<strong>Send onboarding, educational, and promotional communications</strong>. We may use
							your account information (such as your name and email address) to send you onboarding
							messages, product tutorials, feature announcements, newsletters, and other marketing
							communications. You can opt out of non&#8208;transactional emails at any time (see
							&ldquo;Your Choices&rdquo; below).
						</li>
					</ul>

					<h2 className="mt-12 text-2xl font-bold">3. Where Your Data Goes (And Doesn&apos;t)</h2>
					<div className="overflow-x-auto">
						<table className="min-w-full border-collapse border border-border">
							<thead>
								<tr className="bg-muted/50">
									<th className="border border-border px-4 py-2 text-left font-semibold">Data</th>
									<th className="border border-border px-4 py-2 text-left font-semibold">Sent To</th>
									<th className="border border-border px-4 py-2 text-left font-semibold">
										<strong>Not</strong> Sent To
									</th>
								</tr>
							</thead>
							<tbody>
								{DATA_FLOW_ROWS.map((row, i) => (
									<tr key={i} className={i % 2 === 1 ? "bg-muted/25" : ""}>
										<td className="border border-border px-4 py-2 font-medium">{row.data}</td>
										<td className="border border-border px-4 py-2">{row.sentTo}</td>
										<td className="border border-border px-4 py-2">{row.notSentTo}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					<h2 className="mt-12 text-2xl font-bold">4. Data Retention</h2>
					<ul>
						<li>
							<strong>Source Code:</strong> Never stored on Jabberwock servers.
						</li>
						<li>
							<strong>Prompts & Chat Snippets:</strong> Persist in your Cloud workspace until you or your
							organization admin deletes them or disables collection.
						</li>
						<li>
							<strong>Operational Logs & Analytics:</strong> Retained only as needed to operate and secure
							Jabberwock Cloud.
						</li>
					</ul>

					<h2 className="mt-12 text-2xl font-bold">5. Your Choices</h2>
					<ul>
						<li>
							<strong>Manage cookies:</strong> You can block or delete cookies in your browser settings;
							some site features may not function without them.
						</li>
						<li>
							<strong>Disable prompt collection</strong> in Organization settings.
						</li>
						<li>
							<strong>Delete your Cloud account</strong> at any time from{" "}
							<strong>Security Settings</strong> inside Jabberwock Cloud (User Menu &rarr; My Settings
							&rarr; Open Profile).
						</li>
						<li>
							<strong>Marketing communications:</strong> You can unsubscribe from marketing and
							promotional emails by clicking the unsubscribe link in those emails. Transactional or
							service&#8208;related emails (such as password resets, billing notices, or security alerts)
							will continue even if you opt out.
						</li>
					</ul>

					<PrivacyFooterSections />
				</div>
			</div>
		</>
	)
}
