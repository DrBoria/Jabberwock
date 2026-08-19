export function PrivacyFooterSections() {
	return (
		<>
			<h2 className="mt-12 text-2xl font-bold">6. Security Practices</h2>
			<p>
				We use TLS for all data in transit, AES&#8208;256 encryption at rest, least&#8208;privilege IAM,
				continuous monitoring, routine penetration testing, and maintain a SOC 2 program.
			</p>

			<h2 className="mt-12 text-2xl font-bold">7. Updates to This Policy</h2>
			<p>
				If our privacy practices change, we will update this policy and note the new{" "}
				<strong>Last Updated</strong> date at the top. For material changes that affect Cloud workspaces, we
				will also email registered workspace owners before the changes take effect.
			</p>

			<h2 className="mt-12 text-2xl font-bold">8. Contact Us</h2>
			<p>
				Questions or concerns? Email{" "}
				<a href="mailto:privacy@jabberwock.com" className="text-primary hover:underline">
					privacy@jabberwock.com
				</a>
				.
			</p>
		</>
	)
}
