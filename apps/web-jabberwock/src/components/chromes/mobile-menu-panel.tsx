import Link from "next/link"
import { RxGithubLogo } from "react-icons/rx"
import { VscVscode } from "react-icons/vsc"

import { EXTERNAL_LINKS } from "@/lib/constants"
import { ScrollButton } from "@/components/ui"
import ThemeToggle from "@/components/chromes/widgets/theme-toggle"

const ml = "block w-full p-5 py-3 text-left text-foreground active:opacity-50"

export function MobileMenuPanel({
	isMenuOpen,
	stars,
	downloads,
	onClose,
}: {
	isMenuOpen: boolean
	stars: string | null
	downloads: string | null
	onClose: () => void
}) {
	return (
		<div
			className={`fixed top-16 left-0 bg-background right-0 z-[100] transition-all duration-200 pointer-events-none md:hidden ${isMenuOpen ? "block h-dvh" : "hidden"}`}>
			<nav className="flex flex-col justify-between h-full pb-16 overflow-y-auto bg-background pointer-events-auto">
				<div className="grow-1 py-4 font-semibold text-lg">
					<a
						href={EXTERNAL_LINKS.DOCUMENTATION}
						target="_blank"
						rel="noreferrer"
						className={ml}
						onClick={onClose}>
						Docs
					</a>
					<Link href="/pricing" className={ml} onClick={onClose}>
						Pricing
					</Link>
					<div className="mt-4 w-full">
						<div className="px-5 pb-2 pt-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
							Product
						</div>
						<Link href="/extension" className={ml} onClick={onClose}>
							Jabberwock VS Code Extension
						</Link>
						<Link href="/cloud" className={ml} onClick={onClose}>
							Jabberwock Cloud
						</Link>
						<Link href="/slack" className={ml} onClick={onClose}>
							Jabberwock for Slack
						</Link>
						<Link href="/provider" className={ml} onClick={onClose}>
							Jabberwock Router
						</Link>
					</div>
					<div className="mt-4 w-full">
						<div className="px-5 pb-2 pt-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
							Resources
						</div>
						<Link href="/blog" className={ml} onClick={onClose}>
							Blog
						</Link>
						<ScrollButton targetId="faq" className={ml} onClick={onClose}>
							FAQ
						</ScrollButton>
						<Link href="/evals" className={ml} onClick={onClose}>
							Evals
						</Link>
						<a
							href={EXTERNAL_LINKS.DISCORD}
							target="_blank"
							rel="noopener noreferrer"
							className={ml}
							onClick={onClose}>
							Discord
						</a>
						<a
							href={EXTERNAL_LINKS.SECURITY}
							target="_blank"
							rel="noopener noreferrer"
							className={ml}
							onClick={onClose}>
							Security Center
						</a>
					</div>
				</div>
				<div className="border-t border-border">
					<div className="flex items-center justify-around px-6 pt-2">
						<Link
							href={EXTERNAL_LINKS.GITHUB}
							target="_blank"
							className="inline-flex items-center gap-2 rounded-md p-3 text-sm transition-colors hover:bg-accent hover:text-foreground"
							onClick={onClose}>
							<RxGithubLogo className="h-6 w-6" />
							{stars !== null && <span>{stars}</span>}
						</Link>
						<div className="flex items-center rounded-md p-3 transition-colors hover:bg-accent">
							<ThemeToggle />
						</div>
						<Link
							href={EXTERNAL_LINKS.MARKETPLACE}
							target="_blank"
							className="inline-flex items-center gap-2 rounded-md p-3 text-sm transition-colors hover:bg-accent hover:text-foreground"
							onClick={onClose}>
							<VscVscode className="h-6 w-6" />
							{downloads !== null && <span>{downloads}</span>}
						</Link>
					</div>
					<div className="flex gap-2 px-4 pb-4">
						<a
							href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP_HOME}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center justify-center gap-2 rounded-full border border-primary bg-foreground p-4 w-full text-base font-semibold text-background"
							onClick={onClose}>
							Sign up
						</a>
						<a
							href={EXTERNAL_LINKS.CLOUD_APP_LOGIN}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center justify-center gap-2 rounded-full border border-primary bg-background p-4 w-full text-base font-semibold text-primary"
							onClick={onClose}>
							Log in
						</a>
					</div>
				</div>
			</nav>
		</div>
	)
}
