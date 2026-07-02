const tool = {
	type: "function",
	function: {
		name: "analyze_image",
		description:
			"Use vision AI model to analyze an image (like a screenshot, UI layout, architecture diagram) and provide detailed descriptive text or extracted data. Provide the absolute path to the image and an optional prompt instruction on what to look for.",
		parameters: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: "The absolute or relative path to the image file to analyze. (e.g. ./screenshot.png)",
				},
				prompt: {
					type: "string",
					description:
						"Optional. Specific instructions on what to extract or analyze in the image. Defaults to a general detailed description if not provided.",
				},
			},
			required: ["path"],
			additionalProperties: false,
		},
	},
}

export default tool
