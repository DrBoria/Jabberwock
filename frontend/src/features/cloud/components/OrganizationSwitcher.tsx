import { useEffect } from "react"
import { Building2, User } from "lucide-react"

import { type CloudUserInfo, type CloudOrganizationMembership, type ExtensionMessage } from "@jabberwock/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { Select, SelectContent, SelectTrigger, SelectValue } from "@src/shared/ui/selects/select-primitive"
import { PersonalSelectItem, OrganizationList, findOrganizationById, useOrgSwitch } from "./org-switch-shared"

type OrganizationSwitcherProps = {
	userInfo: CloudUserInfo
	organizations: CloudOrganizationMembership[]
	onOrganizationChange?: (organizationId: string | null) => void
	cloudApiUrl?: string
}

export const OrganizationSwitcher = ({
	userInfo,
	organizations,
	onOrganizationChange,
	cloudApiUrl,
}: OrganizationSwitcherProps) => {
	const { t } = useAppTranslation()
	const {
		selectedOrgId,
		setSelectedOrgId,
		isLoading,
		setIsLoading,
		currentValue,
		handleChange: handleOrganizationChange,
	} = useOrgSwitch({
		initialOrgId: userInfo.organizationId || null,
		cloudApiUrl,
		afterSwitch: onOrganizationChange,
	})

	// Listen for organization switch results
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data as ExtensionMessage
			if (message.type === "organizationSwitchResult") {
				// Reset loading state when we receive the result
				setIsLoading(false)

				if (message.success) {
					// Update selected org based on the result
					setSelectedOrgId(message.organizationId ?? null)
				} else {
					// Revert to the previous organization on error
					setSelectedOrgId(userInfo.organizationId || null)
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [userInfo.organizationId, setIsLoading, setSelectedOrgId])

	const currentOrg = findOrganizationById(organizations, selectedOrgId)

	return (
		<div className="w-full">
			<Select value={currentValue} onValueChange={handleOrganizationChange} disabled={isLoading}>
				<SelectTrigger className="w-full">
					<SelectValue>
						<div className="flex items-center gap-2">
							{selectedOrgId ? (
								<>
									{currentOrg?.organization.image_url ? (
										<img
											src={currentOrg.organization.image_url}
											alt=""
											className="w-4.5 h-4.5 rounded-full object-cover overflow-clip"
										/>
									) : (
										<Building2 className="w-4.5 h-4.5" />
									)}
									<span className="truncate">{currentOrg?.organization.name}</span>
								</>
							) : (
								<>
									<div className="p-0.5 bg-vscode-button-background rounded-full flex items-center justify-center text-vscode-button-foreground text-xs">
										<User className="w-4 h-4 text-vscode-button-foreground" />
									</div>
									<span>{t("cloud:personalAccount")}</span>
								</>
							)}
						</div>
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					<PersonalSelectItem>
						<User className="w-4.5 h-4.5" />
					</PersonalSelectItem>
					<OrganizationList organizations={organizations} />
				</SelectContent>
			</Select>
		</div>
	)
}
