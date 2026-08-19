import Link from "next/link"

import { Brain, Cloud, Puzzle, Slack } from "lucide-react"

import { LinearIcon } from "@/components/linear/icon"

import { NavigationMenuLink } from "@/components/ui/navigation-menu"

const linkClass =
	"flex items-center select-none rounded-md px-3 py-2 text-sm leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"

export function ProductLinks({ onClick: _onClick }: { onClick?: () => void }) {
	return (
		<>
			<li>
				<NavigationMenuLink asChild>
					<Link href="/extension" className={linkClass}>
						<Puzzle className="size-3 mr-2" />
						Jabberwock VS Code Extension
					</Link>
				</NavigationMenuLink>
			</li>
			<li>
				<NavigationMenuLink asChild>
					<Link href="/cloud" className={linkClass}>
						<Cloud className="size-3 mr-2" />
						Jabberwock Cloud
					</Link>
				</NavigationMenuLink>
			</li>
			<li>
				<NavigationMenuLink asChild>
					<Link href="/slack" className={linkClass}>
						<Slack className="size-3 mr-2" />
						Jabberwock for Slack
					</Link>
				</NavigationMenuLink>
			</li>
			<li>
				<NavigationMenuLink asChild>
					<Link href="/linear" className={linkClass}>
						<LinearIcon className="size-3 mr-2" />
						Jabberwock for Linear
					</Link>
				</NavigationMenuLink>
			</li>
			<li>
				<NavigationMenuLink asChild>
					<Link href="/provider" className={linkClass}>
						<Brain className="size-3 mr-2" />
						Jabberwock Router
					</Link>
				</NavigationMenuLink>
			</li>
		</>
	)
}
