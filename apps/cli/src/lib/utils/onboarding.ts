import { createElement } from "react"
import { render } from "ink"

import { type OnboardingResult, OnboardingProviderChoice } from "@/types/index.js"
import { login } from "@/commands/index.js"
import { saveSettings } from "@/lib/storage/index.js"
import { OnboardingScreen } from "../../ui/components/onboarding/index.js"

export async function runOnboarding(): Promise<OnboardingResult> {
	return new Promise<OnboardingResult>((resolve) => {
		const onSelect = async (choice: OnboardingProviderChoice) => {
			await saveSettings({ onboardingProviderChoice: choice })

			app.unmount()

			console.log("")

			if (choice === OnboardingProviderChoice.Jabberwock) {
				const result = await login()
				await saveSettings({ onboardingProviderChoice: choice })

				resolve({
					choice: OnboardingProviderChoice.Jabberwock,
					token: result.success ? result.token : undefined,
					skipped: false,
				})
			} else {
				console.log("Using your own API key.")
				console.log("Set your API key via --api-key or environment variable.")
				console.log("")
				resolve({ choice: OnboardingProviderChoice.Byok, skipped: false })
			}
		}

		const app = render(createElement(OnboardingScreen, { onSelect }))
	})
}
