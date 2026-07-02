export const getCheckboxChecked = (e: Event | React.FormEvent<HTMLElement>): boolean =>
	e.target instanceof HTMLInputElement ? e.target.checked : false

export const isValidImageSize = (value: number, min: number, max: number): boolean =>
	!isNaN(value) && value >= min && value <= max
