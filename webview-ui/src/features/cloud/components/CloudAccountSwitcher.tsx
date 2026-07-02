import { useState, useEffect } from "react"
import { Building2, Plus } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectSeparator } from "@src/shared/ui/selects/select"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { rootStore } from "@src/features/store"
import { cn } from "@src/lib/utils"

const getInitial = (name?: string, email?: string): string => {
	if (name) return name.charAt(0)
	if (email) return email.charAt(0)
	return "?"
}

const getDisplayName = (name?: string, email?: string): string => {
	if (name) return name
	return email ?? ""
}

const nonNullValue = (value: string | null, fallback: string): string => {
	if (value) return value
	return fallback
}

const handleOrgChange = (
	value: string,
	selectedOrgId: string | null,
	cloudApiUrl: string | undefined,
	onSwitchOrg: (orgId: string | null) => void,
	onLoadingChange: (loading: boolean) => void,
) => {
	if (value === "create-team") {
		if (cloudApiUrl) {
			rootStore.settings.openExternal(`${cloudApiUrl}/billing`)
		}
		return
	}

	const newOrgId = value === "personal" ? null : value

	if (newOrgId === selectedOrgId) {
		return
	}

	onLoadingChange(true)
	rootStore.cloud.switchOrganization(newOrgId)
	onSwitchOrg(newOrgId)
	setTimeout(() => {
		onLoadingChange(false)
	}, 1000)
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

const OrganizationLogo = ({ imageUrl }: { imageUrl?: string }) => {
	if (imageUrl) {
		return <img src={imageUrl} alt="" className="w-4.5 h-4.5 rounded-full object-cover overflow-clip" />
	}
	return <Building2 className="w-4.5 h-4.5" />
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
	const [selectedOrgId, setSelectedOrgId] = useState<string | null>(cloudUserInfo?.organizationId || null)
	const [isLoading, setIsLoading] = useState(false)

	useEffect(() => {
		setSelectedOrgId(cloudUserInfo?.organizationId || null)
	}, [cloudUserInfo?.organizationId])

	if (!cloudUserInfo) {
		return null
	}

	const currentOrg = cloudOrganizations.find((org) => org.organization.id === selectedOrgId)

	return (
		<div className="inline-block ml-1">
			<Select
				value={nonNullValue(selectedOrgId, "personal")}
				onValueChange={(value) =>
					handleOrgChange(value, selectedOrgId, cloudApiUrl, setSelectedOrgId, setIsLoading)
				}
				disabled={isLoading}>
				<SelectTrigger
					className={getTriggerClasses(isLoading)}
					aria-label={selectedOrgId ? currentOrg?.organization.name : t("cloud:personalAccount")}>
					<AccountIcon selectedOrgId={selectedOrgId} currentOrg={currentOrg} cloudUserInfo={cloudUserInfo} />
				</SelectTrigger>

				<SelectContent>
					<SelectItem value="personal">
						<div className="flex items-center gap-2">
							<Avatar
								picture={cloudUserInfo.picture}
								name={cloudUserInfo.name}
								email={cloudUserInfo.email}
							/>
							<span>{t("cloud:personalAccount")}</span>
						</div>
					</SelectItem>

					{cloudOrganizations.length > 0 && <SelectSeparator />}

					{cloudOrganizations.map((org) => (
						<SelectItem key={org.organization.id} value={org.organization.id}>
							<div className="flex items-center gap-2">
								<OrganizationLogo imageUrl={org.organization.image_url} />
								<span className="truncate">{org.organization.name}</span>
							</div>
						</SelectItem>
					))}

					{cloudOrganizations.length === 0 && (
						<>
							<SelectSeparator />
							<SelectItem value="create-team">
								<div className="flex items-center gap-2">
									<Plus className="w-4.5 h-4.5" />
									<span>{t("cloud:createTeamAccount")}</span>
								</div>
							</SelectItem>
						</>
					)}
				</SelectContent>
			</Select>
		</div>
	)
}
