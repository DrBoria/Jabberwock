import React from "react"
import { render, RenderOptions } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { TooltipProvider } from "@src/shared/ui/tooltips/tooltip"
import { STANDARD_TOOLTIP_DELAY } from "@src/shared/ui/tooltips/standard-tooltip"

interface AllTheProvidersProps {
	children: React.ReactNode
}

const AllTheProviders = ({ children }: AllTheProvidersProps) => {
	// Create a new QueryClient for each test to avoid state leakage
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false, // Disable retries in tests
			},
		},
	})

	return (
		<QueryClientProvider client={queryClient}>
			<TooltipProvider delayDuration={STANDARD_TOOLTIP_DELAY}>{children}</TooltipProvider>
		</QueryClientProvider>
	)
}

const customRender = (ui: React.ReactElement, options?: Omit<RenderOptions, "wrapper">) => {
	const renderOptions = { wrapper: AllTheProviders, ...options }
	return render(ui, renderOptions)
}

// override render method
export { customRender as render }
