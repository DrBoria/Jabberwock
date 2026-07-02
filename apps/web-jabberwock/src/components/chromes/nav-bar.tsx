/* eslint-disable react/jsx-no-target-blank */

"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { RxGithubLogo } from "react-icons/rx"
import { VscVscode } from "react-icons/vsc"
import { HiMenu } from "react-icons/hi"

import { EXTERNAL_LINKS } from "@/lib/constants"
import { useLogoSrc } from "@/lib/hooks/use-logo-src"

import ThemeToggle from "@/components/chromes/widgets/theme-toggle"
import { X } from "lucide-react"
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
	navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { cn } from "@/lib/utils"
import { MobileMenuPanel } from "./mobile-menu-panel"
import { ProductLinks } from "./product-links"
import { ResourceLinks } from "./resource-links"

interface NavBarProps {
	stars: string | null
	downloads: string | null
}

export function NavBar({ stars, downloads }: NavBarProps) {
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const logoSrc = useLogoSrc()

	return (
		<header className="sticky font-light top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
			<div className="container flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
				<div className="flex items-center flex-shrink-0">
					<Link href="/" className="flex items-center">
						<Image
							src={logoSrc}
							alt="Jabberwock Logo"
							width={130}
							height={24}
							className="h-[24px] w-auto"
						/>
					</Link>
				</div>

				<NavigationMenu className="grow ml-6 hidden text-sm md:flex">
					<NavigationMenuList>
						<NavigationMenuItem>
							<NavigationMenuTrigger className="bg-transparent font-light">Product</NavigationMenuTrigger>
							<NavigationMenuContent>
								<ul className="grid min-w-[260px] gap-1 p-2">
									<ProductLinks />
								</ul>
							</NavigationMenuContent>
						</NavigationMenuItem>

						<NavigationMenuItem>
							<NavigationMenuTrigger className="bg-transparent font-light">
								Resources
							</NavigationMenuTrigger>
							<NavigationMenuContent>
								<ul className="grid min-w-[260px] gap-1 p-2">
									<ResourceLinks />
								</ul>
							</NavigationMenuContent>
						</NavigationMenuItem>

						<NavigationMenuItem>
							<NavigationMenuLink
								asChild
								className={cn(navigationMenuTriggerStyle(), "bg-transparent font-light")}>
								<a href={EXTERNAL_LINKS.DOCUMENTATION} target="_blank">
									Docs
								</a>
							</NavigationMenuLink>
						</NavigationMenuItem>

						<NavigationMenuItem>
							<NavigationMenuLink
								asChild
								className={cn(navigationMenuTriggerStyle(), "bg-transparent font-light")}>
								<Link href="/pricing">Pricing</Link>
							</NavigationMenuLink>
						</NavigationMenuItem>
					</NavigationMenuList>
				</NavigationMenu>

				<div className="hidden md:flex md:items-center md:space-x-4 flex-shrink-0 font-medium">
					<div className="flex flex-row space-x-2 flex-shrink-0">
						<ThemeToggle />
						<Link
							href={EXTERNAL_LINKS.GITHUB}
							target="_blank"
							className="hidden items-center gap-1.5 text-sm hover:text-foreground md:flex whitespace-nowrap">
							<RxGithubLogo className="h-4 w-4" />
							{stars !== null && <span>{stars}</span>}
						</Link>
					</div>
					<a
						href={EXTERNAL_LINKS.CLOUD_APP_LOGIN}
						target="_blank"
						rel="noopener noreferrer"
						className="hidden items-center gap-1.5 rounded-md py-2 text-sm border border-primary-background px-4 text-primary-background transition-all duration-200 hover:shadow-lg hover:scale-105 lg:flex">
						Log in
					</a>
					<a
						href={EXTERNAL_LINKS.CLOUD_APP_SIGNUP_HOME}
						target="_blank"
						rel="noopener noreferrer"
						className="hidden items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-all duration-200 hover:shadow-lg hover:scale-105 md:flex">
						Sign Up
					</a>
					<Link
						href={EXTERNAL_LINKS.MARKETPLACE}
						target="_blank"
						className="hidden items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-all duration-200 hover:shadow-lg hover:scale-105 md:flex whitespace-nowrap">
						<VscVscode className="-mr-[2px] mt-[1px] h-4 w-4" />
						<span>
							Install <span className="font-black max-lg:text-xs">&middot;</span>
						</span>
						{downloads !== null && <span>{downloads}</span>}
					</Link>
				</div>

				<button
					aria-expanded={isMenuOpen}
					onClick={() => setIsMenuOpen(!isMenuOpen)}
					className="relative z-10 flex items-center justify-center rounded-full p-2 transition-colors hover:bg-accent md:hidden"
					aria-label="Toggle mobile menu">
					<HiMenu className={`h-6 w-6 ${isMenuOpen ? "hidden" : "block"}`} />
					<X className={`h-6 w-6 ${isMenuOpen ? "block" : "hidden"}`} />
				</button>
			</div>

			<MobileMenuPanel
				isMenuOpen={isMenuOpen}
				stars={stars}
				downloads={downloads}
				onClose={() => setIsMenuOpen(false)}
			/>
		</header>
	)
}
