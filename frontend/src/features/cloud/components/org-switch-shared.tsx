import { useState, useEffect, useCallback } from "react"
import { Building2, Plus } from "lucide-react"

import { SelectItem, SelectSeparator } from "@src/shared/ui/selects/select-primitive"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { rootStore } from "@src/features/store"

import type { CloudOrganizationMembership } from "@jabberwock/types"

/** Find a membership entry by its organization id (null → undefined). */
export const findOrganizationById = (
	organizations: CloudOrganizationMembership[],
	organizationId: string | null,
): CloudOrganizationMembership | undefined => {
	if (!organizationId) return undefined
	return organizations.find((org) => org.organization.id === organizationId)
}

interface UseOrgSwitchOptions {
	initialOrgId: string | null
	cloudApiUrl?: string
	/** Called after a successful optimistic switch (before the async result lands). */
	afterSwitch?: (orgId: string | null) => void
}

/**
 * Shared organization-switch state machine for the org/account switchers:
 * create-team routing, personal→null normalization, same-org no-op guard,
 * optimistic update + loading flag. Callers clear `isLoading` via their own
 * mechanism (message result vs. timeout) using the returned `setIsLoading`.
 */
export function useOrgSwitch({ initialOrgId, cloudApiUrl, afterSwitch }: UseOrgSwitchOptions) {
	const [selectedOrgId, setSelectedOrgId] = useState<string | null>(initialOrgId)
	const [isLoading, setIsLoading] = useState(false)

	useEffect(() => {
		setSelectedOrgId(initialOrgId)
	}, [initialOrgId])

	const handleChange = useCallback(
		(value: string) => {
			if (value === "create-team") {
				if (cloudApiUrl) {
					rootStore.settings.openExternal(`${cloudApiUrl}/billing`)
				}
				return
			}

			const newOrgId = value === "personal" ? null : value
			if (newOrgId === selectedOrgId) return

			setIsLoading(true)
			rootStore.cloud.switchOrganization(newOrgId)
			setSelectedOrgId(newOrgId)
			afterSwitch?.(newOrgId)
		},
		[cloudApiUrl, selectedOrgId, afterSwitch],
	)

	return {
		selectedOrgId,
		setSelectedOrgId,
		isLoading,
		setIsLoading,
		currentValue: selectedOrgId || "personal",
		handleChange,
	}
}

export const OrganizationLogo = ({ imageUrl }: { imageUrl?: string }) => {
	if (imageUrl) {
		return <img src={imageUrl} alt="" className="w-4.5 h-4.5 rounded-full object-cover overflow-clip" />
	}
	return <Building2 className="w-4.5 h-4.5" />
}

interface OrganizationSelectItemProps {
	membership: CloudOrganizationMembership
}

export const OrganizationSelectItem = ({ membership }: OrganizationSelectItemProps) => {
	const { organization } = membership
	return (
		<SelectItem key={organization.id} value={organization.id}>
			<div className="flex items-center gap-2">
				<OrganizationLogo imageUrl={organization.image_url} />
				<span className="truncate">{organization.name}</span>
			</div>
		</SelectItem>
	)
}

export const CreateTeamSelectItem = () => {
	const { t } = useAppTranslation()
	return (
		<SelectItem value="create-team">
			<div className="flex items-center gap-2">
				<Plus className="w-4.5 h-4.5" />
				<span>{t("cloud:createTeamAccount")}</span>
			</div>
		</SelectItem>
	)
}

interface PersonalSelectItemProps {
	children: React.ReactNode
}

export const PersonalSelectItem = ({ children }: PersonalSelectItemProps) => {
	const { t } = useAppTranslation()
	return (
		<SelectItem value="personal">
			<div className="flex items-center gap-2">
				{children}
				<span>{t("cloud:personalAccount")}</span>
			</div>
		</SelectItem>
	)
}

interface OrganizationListProps {
	organizations: CloudOrganizationMembership[]
}

export const OrganizationList = ({ organizations }: OrganizationListProps) => (
	<>
		{organizations.length > 0 && <SelectSeparator />}
		{organizations.map((org) => (
			<OrganizationSelectItem key={org.organization.id} membership={org} />
		))}
		{organizations.length === 0 && (
			<>
				<SelectSeparator />
				<CreateTeamSelectItem />
			</>
		)}
	</>
)
