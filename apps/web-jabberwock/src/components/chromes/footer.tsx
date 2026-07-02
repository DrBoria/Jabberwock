"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { ChevronDown } from "lucide-react"
import { useTheme } from "next-themes"

import { useLogoSrc } from "@/lib/hooks/use-logo-src"
import { ScrollButton } from "@/components/ui"
import { PRODUCT_LINKS, RESOURCES_LINKS, COMPANY_LINKS, CONNECT_LINKS, type FooterLink } from "./footer-link-data"

function FooterLinkItem({ link, onClick }: { link: FooterLink & { external?: boolean }; onClick?: () => void }) {
	if (link.external || link.href?.startsWith("mailto:")) {
		return (
			<a
				href={link.href}
				target="_blank"
				rel="noopener noreferrer"
				onClick={onClick}
				className="text-sm leading-6 text-muted-foreground transition-colors hover:text-foreground">
				{link.label}
			</a>
		)
	}
	if (link.scrollTarget) {
		return (
			<ScrollButton
				targetId={link.scrollTarget}
				className="text-sm leading-6 text-muted-foreground transition-colors hover:text-foreground">
				{link.label}
			</ScrollButton>
		)
	}
	return (
		<Link
			href={link.href ?? "#"}
			onClick={onClick}
			className="text-sm leading-6 text-muted-foreground transition-colors hover:text-foreground">
			{link.label}
		</Link>
	)
}

function FooterDropdown({ label, items }: { label: string; items: FooterLink[] }) {
	const [isOpen, setIsOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (ref.current && !ref.current.contains(event.target as Node)) {
				setIsOpen(false)
			}
		}
		document.addEventListener("mousedown", handleClickOutside)
		return () => document.removeEventListener("mousedown", handleClickOutside)
	}, [])

	return (
		<div className="relative z-10" ref={ref}>
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="flex items-center text-sm leading-6 text-muted-foreground transition-colors hover:text-foreground"
				aria-expanded={isOpen}
				aria-haspopup="true">
				<span>{label}</span>
				<ChevronDown className={`ml-1 h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
			</button>
			{isOpen && (
				<div className="absolute z-50 mt-2 w-44 origin-top-left scale-95 rounded-md border border-border bg-background shadow-lg ring-1 ring-black ring-opacity-5 transition-all duration-100 ease-out data-[state=open]:scale-100 max-xs:right-0 max-xs:origin-top-right xs:left-0">
					<div className="flex flex-col gap-1 p-2 text-sm text-muted-foreground">
						{items.map((item) => (
							<FooterLinkItem key={item.label} link={item} onClick={() => setIsOpen(false)} />
						))}
					</div>
				</div>
			)}
		</div>
	)
}

export function Footer() {
	const logoSrc = useLogoSrc()
	const { resolvedTheme } = useTheme()

	return (
		<footer className="border-t border-border bg-background">
			<div className="mx-auto max-w-7xl px-6 pb-6 pt-12 md:pb-8 md:pt-16 lg:px-8">
				<div className="xl:grid xl:grid-cols-3 xl:gap-8">
					<div className="space-y-8">
						<div className="flex items-center">
							<Image src={logoSrc} alt="Jabberwock Logo" width={120} height={40} className="h-6 w-auto" />
						</div>
						<p className="max-w-md text-sm leading-6 text-muted-foreground md:pr-16 lg:pr-32">
							Empowering developers to build better software faster with AI-powered tools and insights.
						</p>
						<a
							href="https://jabberwock.com"
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center space-x-2 group">
							<Image
								src={
									resolvedTheme === "light"
										? "/Jabberwock-Badge-blk.svg"
										: "/Jabberwock-Badge-white.svg"
								}
								alt="Made with Jabberwock"
								width={120}
								height={40}
								className="h-8 w-auto opacity-70 transition-opacity group-hover:opacity-100"
							/>
						</a>
					</div>

					<div className="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
						<div className="md:grid md:grid-cols-2 md:gap-8">
							<div>
								<h3 className="text-sm font-semibold uppercase leading-6 text-foreground">Product</h3>
								<ul className="mt-6 space-y-4">
									{PRODUCT_LINKS.map((item) => {
										const key = "key" in item ? item.key : item.label
										return (
											<li key={key}>
												{"type" in item && item.type === "dropdown" ? (
													<FooterDropdown label={item.label} items={item.items} />
												) : (
													<FooterLinkItem link={item} />
												)}
											</li>
										)
									})}
								</ul>
							</div>
							<div className="mt-10 md:mt-0">
								<h3 className="text-sm font-semibold uppercase leading-6 text-foreground">Resources</h3>
								<ul className="mt-6 space-y-4">
									{RESOURCES_LINKS.map((link) => (
										<li key={link.label}>
											<FooterLinkItem link={link} />
										</li>
									))}
								</ul>
							</div>
						</div>
						<div className="md:grid md:grid-cols-2 md:gap-8">
							<div>
								<h3 className="text-sm font-semibold uppercase leading-6 text-foreground">Company</h3>
								<ul className="mt-6 space-y-4">
									{COMPANY_LINKS.map((item) => {
										const key = "key" in item ? item.key : item.label
										return (
											<li key={key}>
												{"type" in item && item.type === "dropdown" ? (
													<FooterDropdown label={item.label} items={item.items} />
												) : (
													<FooterLinkItem link={item} />
												)}
											</li>
										)
									})}
								</ul>
							</div>
							<div className="mt-10 md:mt-0">
								<h3 className="text-sm font-semibold uppercase leading-6 text-foreground">Connect</h3>
								<ul className="mt-6 space-y-4">
									{CONNECT_LINKS.map((link) => (
										<li key={link.label}>
											<FooterLinkItem link={link} />
										</li>
									))}
								</ul>
							</div>
						</div>
					</div>
				</div>

				<div className="mt-16 flex border-t border-border pt-8 sm:mt-20 lg:mt-24">
					<p className="mx-auto text-sm leading-5 text-muted-foreground">
						&copy; {new Date().getFullYear()} Jabberwock. All rights reserved.
					</p>
				</div>
			</div>
		</footer>
	)
}
