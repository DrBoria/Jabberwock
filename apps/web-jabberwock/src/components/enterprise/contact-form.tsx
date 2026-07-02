"use client"

import { useState, useRef } from "react"

import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui"
import type { ContactFormProps } from "./contact-form-schema"
import { contactFormSchema, submitToBasin, getFormErrors } from "./contact-form-schema"
import { FormField, SuccessView } from "./contact-form-components"

export function ContactForm({ formType, buttonText, buttonClassName }: ContactFormProps) {
	const [isOpen, setIsOpen] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [formErrors, setFormErrors] = useState<Record<string, string>>({})
	const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle")
	const formRef = useRef<HTMLFormElement>(null)

	const formTitle = formType === "early-access" ? "Become an Early Access Partner" : "Request a Demo"
	const formDescription =
		formType === "early-access"
			? "Fill out the form below to collaborate in shaping Jabberwock's enterprise solution."
			: "Fill out the form below to see Jabberwock's enterprise capabilities in action."

	const BASIN_ENDPOINT = process.env.NEXT_PUBLIC_BASIN_ENDPOINT || ""

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		setIsSubmitting(true)
		setFormErrors({})
		setSubmitStatus("idle")

		const form = e.currentTarget
		const formData = new FormData(form)

		const data = {
			name: formData.get("name") as string,
			company: formData.get("company") as string,
			email: formData.get("email") as string,
			website: formData.get("website") as string,
			engineerCount: formData.get("engineerCount") as string,
			formType,
			_honeypot: formData.get("_honeypot") as string,
		}

		try {
			contactFormSchema.parse(data)
			const result = await submitToBasin(BASIN_ENDPOINT, data)
			setSubmitStatus(result)
			if (result === "success") {
				form.reset()
			}
		} catch (error) {
			const errors = getFormErrors(error)
			if (errors) {
				setFormErrors(errors)
			} else {
				setSubmitStatus("error")
			}
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button className={buttonClassName || ""}>{buttonText}</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>{formTitle}</DialogTitle>
					<DialogDescription>{formDescription}</DialogDescription>
				</DialogHeader>

				{submitStatus === "success" ? (
					<SuccessView onClose={() => setIsOpen(false)} />
				) : (
					<form ref={formRef} onSubmit={handleSubmit} className="space-y-4" data-basin-form>
						<input type="text" name="_honeypot" className="hidden" style={{ display: "none" }} />

						<FormField
							label="Name"
							name="name"
							type="text"
							placeholder="Your name"
							error={formErrors.name}
							required
						/>
						<FormField
							label="Company"
							name="company"
							type="text"
							placeholder="Your company"
							error={formErrors.company}
							required
						/>
						<FormField
							label="Email"
							name="email"
							type="email"
							placeholder="your.email@example.com"
							error={formErrors.email}
							required
						/>
						<FormField
							label="Website"
							name="website"
							type="url"
							placeholder="https://example.com"
							error={formErrors.website}
						/>
						<FormField
							label="Number of Software Engineers"
							name="engineerCount"
							type="select"
							placeholder=""
							error={formErrors.engineerCount}
							required
						/>

						{submitStatus === "error" && (
							<div className="rounded-md bg-red-50 p-3 text-sm text-red-500 dark:bg-red-900/20">
								There was an error submitting your request. Please try again later.
							</div>
						)}

						<DialogFooter>
							<Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
								Cancel
							</Button>
							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting ? "Submitting..." : "Submit"}
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	)
}
