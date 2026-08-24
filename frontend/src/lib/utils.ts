import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
	const classes = clsx(inputs)
	return classes ? twMerge(classes) : ""
}
