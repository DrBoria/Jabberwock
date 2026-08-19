import Link from "next/link"

import { EXTERNAL_LINKS } from "@/lib/constants"

import { NavigationMenuLink } from "@/components/ui/navigation-menu"

export function ResourceLinks({ onClick: _onClick }: { onClick?: () => void }) {
	const rc =
		"block select-none rounded-md px-3 py-2 text-sm leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
	return (
		<>
			<li>
				<NavigationMenuLink asChild>
					<Link href="/blog" className={rc}>
						Blog
					</Link>
				</NavigationMenuLink>
			</li>
			<li>
				<NavigationMenuLink asChild>
					<Link href="/evals" className={rc}>
						Evals
					</Link>
				</NavigationMenuLink>
			</li>
			<li>
				<NavigationMenuLink asChild>
					<a href={EXTERNAL_LINKS.DISCORD} target="_blank" rel="noopener noreferrer" className={rc}>
						Discord
					</a>
				</NavigationMenuLink>
			</li>
			<li>
				<NavigationMenuLink asChild>
					<a href={EXTERNAL_LINKS.SECURITY} target="_blank" rel="noopener noreferrer" className={rc}>
						Trust Center
					</a>
				</NavigationMenuLink>
			</li>
		</>
	)
}
