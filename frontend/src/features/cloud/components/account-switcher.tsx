import { Building2 } from "lucide-react"
import { Select, SelectContent, SelectTrigger } from "@src/shared/ui/selects/select-primitive"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { rootStore } from "@src/features/store"
import { cn } from "@src/lib/utils"
import { PersonalSelectItem, OrganizationList, findOrganizationById, useOrgSwitch } from "./org-switch-shared"

const getInitial = (name?: string, email?: string): string => {
	if (name) return name.charAt(0)
	if (email) return email.charAt(0)
	return "?"
}

const getDisplayName = (name?: string, email?: string): string => {
	if (name) return name
	return email ?? ""
}

interface AccountIconProps {
	selectedOrgId: string | null
	currentOrg?: { organization: { image_url?: string; name: string } } | null
	cloudUserInfo: { picture?: string; name?: string; email?: string }
}

const AccountIcon = ({ selectedOrgId, currentOrg, cloudUserInfo }: AccountIconProps) => {
	if (selectedOrgId && currentOrg?.organization.image_url) {
		return (
			<img
				src={currentOrg.organization.image_url}
				alt={currentOrg.organization.name}
				className="w-5 h-5 rounded object-cover"
			/>
		)
	}
	if (selectedOrgId) {
		return <Building2 className="w-4.5 h-4.5" />
	}
	if (cloudUserInfo.picture) {
		return (
			<img
				src={cloudUserInfo.picture}
				alt={getDisplayName(cloudUserInfo.name, cloudUserInfo.email)}
				className="w-5 h-5 rounded-full object-cover"
			/>
		)
	}
	return (
		<div className="w-5 h-5 rounded-full flex items-center justify-center bg-vscode-button-background text-vscode-button-foreground text-xs">
			{getInitial(cloudUserInfo.name, cloudUserInfo.email)}
		</div>
	)
}

interface AvatarProps {
	picture?: string
	name?: string
	email?: string
}

const Avatar = ({ picture, name, email }: AvatarProps) => {
	if (picture) {
		return (
			<img
				src={picture}
				alt={getDisplayName(name, email)}
				className="w-4.5 h-4.5 rounded-full object-cover overflow-clip"
			/>
		)
	}
	return (
		<div className="w-4.5 h-4.5 rounded-full flex items-center justify-center bg-vscode-button-background text-vscode-button-foreground text-xs">
			{getInitial(name, email)}
		</div>
	)
}

const getTriggerClasses = (isLoading: boolean) =>
	cn(
		"h-4.5 w-4.5 p-0 gap-0",
		"bg-transparent opacity-90 hover:opacity-50",
		"flex items-center justify-center",
		"rounded-lg overflow-clip",
		"border border-vscode-dropdown-border",
		"[&>svg]:hidden",
		isLoading && "opacity-50",
	)

export const CloudAccountSwitcher = () => {
	const { t } = useAppTranslation()
	const cloud = rootStore.cloud
	const cloudUserInfo = rootStore.extensionState.cloudUserInfo
	const cloudOrganizations = cloud.cloudOrganizations ?? []
	const cloudApiUrl = rootStore.extensionState.cloudApiUrl
	const { selectedOrgId, isLoading, setIsLoading, currentValue, handleChange } = useOrgSwitch({
		initialOrgId: cloudUserInfo?.organizationId || null,
		cloudApiUrl,
		afterSwitch: () => {
			setTimeout(() => setIsLoading(false), 1000)
		},
	})

	if (!cloudUserInfo) {
		return null
	}

	const currentOrg = findOrganizationById(cloudOrganizations, selectedOrgId)

	return (
		<div className="inline-block ml-1">
			<Select value={currentValue} onValueChange={handleChange} disabled={isLoading}>
				<SelectTrigger
					className={getTriggerClasses(isLoading)}
					aria-label={selectedOrgId ? currentOrg?.organization.name : t("cloud:personalAccount")}>
					<AccountIcon selectedOrgId={selectedOrgId} currentOrg={currentOrg} cloudUserInfo={cloudUserInfo} />
				</SelectTrigger>

				<SelectContent>
					<PersonalSelectItem>
						<Avatar picture={cloudUserInfo.picture} name={cloudUserInfo.name} email={cloudUserInfo.email} />
					</PersonalSelectItem>
					<OrganizationList organizations={cloudOrganizations} />
				</SelectContent>
			</Select>
		</div>
	)
}
