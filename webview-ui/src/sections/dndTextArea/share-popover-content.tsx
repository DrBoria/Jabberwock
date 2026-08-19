import { type ShareVisibility } from "@jabberwock/types"
import { PopoverContent } from "@src/shared/ui/overlays/popover"
import { Command, CommandList, CommandItem, CommandGroup } from "@src/shared/ui/overlays/command"

interface SharePopoverContentProps {
	shareSuccess: { visibility: ShareVisibility; url: string } | null
	t: (key: string) => string
	cloudUserInfo: { organizationName?: string } | null | undefined
	handleShare: (visibility: ShareVisibility) => void
	publicSharingEnabled: boolean
}

export const SharePopoverContent: React.FC<SharePopoverContentProps> = ({
	shareSuccess,
	t,
	cloudUserInfo,
	handleShare,
	publicSharingEnabled,
}) => {
	if (shareSuccess) {
		return (
			<PopoverContent className="w-56 p-0" align="start">
				<div className="p-3">
					<div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
						<span className="codicon codicon-check"></span>
						<span>
							{shareSuccess.visibility === "public"
								? t("chat:task.shareSuccessPublic")
								: t("chat:task.shareSuccessOrganization")}
						</span>
					</div>
				</div>
			</PopoverContent>
		)
	}

	return (
		<PopoverContent className="w-56 p-0" align="start">
			<Command>
				<CommandList>
					<CommandGroup>
						{cloudUserInfo?.organizationName && (
							<CommandItem onSelect={() => handleShare("organization")} className="cursor-pointer">
								<div className="flex items-center gap-2">
									<span className="codicon codicon-organization text-sm"></span>
									<div className="flex flex-col">
										<span className="text-sm">{t("chat:task.shareWithOrganization")}</span>
										<span className="text-xs text-vscode-descriptionForeground">
											{t("chat:task.shareWithOrganizationDescription")}
										</span>
									</div>
								</div>
							</CommandItem>
						)}
						{publicSharingEnabled && (
							<CommandItem onSelect={() => handleShare("public")} className="cursor-pointer">
								<div className="flex items-center gap-2">
									<span className="codicon codicon-globe text-sm"></span>
									<div className="flex flex-col">
										<span className="text-sm">{t("chat:task.sharePublicly")}</span>
										<span className="text-xs text-vscode-descriptionForeground">
											{t("chat:task.sharePubliclyDescription")}
										</span>
									</div>
								</div>
							</CommandItem>
						)}
					</CommandGroup>
				</CommandList>
			</Command>
		</PopoverContent>
	)
}
