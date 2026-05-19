import { render, screen, fireEvent } from "@/utils/test-utils"

import { ExportButton } from "../ExportButton"

const mockExportTaskWithId = vi.fn()

vi.mock("@src/features/store", () => ({
	rootStore: {
		history: {
			exportTaskWithId: mockExportTaskWithId,
		},
	},
}))

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe("ExportButton", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("sends export message when clicked", () => {
		render(<ExportButton itemId="1" />)

		const exportButton = screen.getByRole("button")
		fireEvent.click(exportButton)

		expect(mockExportTaskWithId).toHaveBeenCalledWith("1")
	})
})
