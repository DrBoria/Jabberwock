import { z } from "zod"

export const contactFormSchema = z.object({
	name: z.string().min(1, "Name is required"),
	company: z.string().min(1, "Company is required"),
	email: z.string().email("Invalid email address"),
	website: z.string().url("Invalid website URL").or(z.string().length(0)),
	engineerCount: z.enum(["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"]),
	formType: z.enum(["early-access", "demo"]),
	_honeypot: z.string().optional(),
})

export interface ContactFormProps {
	formType: "early-access" | "demo"
	buttonText: string
	buttonClassName?: string
}

export function getFieldClassName(fieldError: string | undefined): string {
	const borderClass = fieldError ? "border-red-500" : "border-input"
	return `w-full rounded-md border ${borderClass} bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring`
}

export async function submitToBasin(endpoint: string, data: Record<string, unknown>): Promise<"success" | "error"> {
	try {
		const response = await fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json", Accept: "application/json" },
			mode: "cors",
			body: JSON.stringify(data),
		})
		if (!response.ok) return "error"
		const responseData = await response.json()
		return responseData && (responseData.success === true || responseData.status === "success")
			? "success"
			: "error"
	} catch {
		return "error"
	}
}

export function getFormErrors(error: unknown): Record<string, string> | null {
	if (!(error instanceof z.ZodError)) return null

	const errors: Record<string, string> = {}
	for (const err of error.errors) {
		if (err.path[0]) {
			errors[err.path[0] as string] = err.message
		}
	}
	return errors
}
