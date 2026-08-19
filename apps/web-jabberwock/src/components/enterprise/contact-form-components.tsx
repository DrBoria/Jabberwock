import { Button } from "@/components/ui"
import { getFieldClassName } from "./contact-form-schema"

export function FormField({
	label,
	name,
	type,
	placeholder,
	error,
	required,
}: {
	label: string
	name: string
	type: string
	placeholder: string
	error: string | undefined
	required?: boolean
}) {
	return (
		<div className="space-y-2">
			<label htmlFor={name} className="text-sm font-medium">
				{label}
				{required && <span className="text-red-500"> *</span>}
			</label>
			{type === "select" ? (
				<select id={name} name={name} className={getFieldClassName(error)} defaultValue="1-10">
					<option value="1-10">1-10</option>
					<option value="11-50">11-50</option>
					<option value="51-200">51-200</option>
					<option value="201-500">201-500</option>
					<option value="501-1000">501-1000</option>
					<option value="1000+">1000+</option>
				</select>
			) : (
				<input
					id={name}
					name={name}
					type={type}
					className={getFieldClassName(error)}
					placeholder={placeholder}
				/>
			)}
			{error && <p className="text-xs text-red-500">{error}</p>}
		</div>
	)
}

export function SuccessView({ onClose }: { onClose: () => void }) {
	return (
		<div className="flex flex-col items-center justify-center py-6">
			<div className="mb-4 rounded-full bg-green-100 p-3 text-green-600 dark:bg-green-900/20 dark:text-green-400">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					className="h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
				</svg>
			</div>
			<h3 className="mb-2 text-xl font-bold">Thank You!</h3>
			<p className="text-center text-muted-foreground">
				Your information has been submitted successfully. Our team will be in touch with you shortly.
			</p>
			<Button className="mt-4" onClick={onClose}>
				Close
			</Button>
		</div>
	)
}
