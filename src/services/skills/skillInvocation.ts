import type { SkillContent } from "@shared/skills"

export interface SkillLookup {
	getSkillContent(name: string, currentMode?: string): Promise<SkillContent | null>
}

export async function resolveSkillContentForMode(
	skillsManager: SkillLookup | undefined,
	skillName: string,
	currentMode: string,
): Promise<SkillContent | null> {
	if (!skillsManager) {
		return null
	}

	return skillsManager.getSkillContent(skillName, currentMode)
}

type SkillContentForFormatting = Pick<SkillContent, "source" | "description" | "instructions">

/**
 * Builds an approval message string for a skill execution request.
 */
export function buildSkillApprovalMessage(
	skillName: string,
	args: string | undefined,
	skillContent: SkillContentForFormatting,
): string {
	let msg = `**Skill:** ${skillName}`
	if (args) {
		msg += `\n**Args:** ${args}`
	}
	if (skillContent.source) {
		msg += `\n**Source:** ${skillContent.source}`
	}
	if (skillContent.description) {
		msg += `\n**Description:** ${skillContent.description}`
	}
	return msg
}

/**
 * Builds a result message string after a skill has been approved and executed.
 */
export function buildSkillResult(
	skillName: string,
	args: string | undefined,
	skillContent: SkillContentForFormatting,
): string {
	let msg = `Skill: ${skillName}`
	if (args) {
		msg += `\nArgs: ${args}`
	}
	msg += `\n\n--- Skill Instructions ---\n\n${skillContent.instructions}`
	return msg
}
