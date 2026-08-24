export const noTransform = <T>(value: T) => value

export const inputEventTransform = (event: { target: HTMLInputElement }): string => event.target.value
