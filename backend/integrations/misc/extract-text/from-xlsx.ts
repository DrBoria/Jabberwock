import ExcelJS from "exceljs"

const ROW_LIMIT = 50000

function formatFormulaCell(value: unknown): string {
	if (typeof value === "object" && value !== null) {
		if ("result" in value && value.result !== undefined && value.result !== null) {
			return String(value.result)
		}
		if ("formula" in value) {
			return `[Formula: ${String(value.formula)}]`
		}
	}
	return ""
}

function formatCellValue(cell: ExcelJS.Cell): string {
	const value = cell.value
	if (value === null || value === undefined) {
		return ""
	}

	if (typeof value !== "object") {
		return value.toString()
	}

	if ("error" in value) {
		return `[Error: ${value.error}]`
	}

	if (value instanceof Date) {
		return value.toISOString().split("T")[0]
	}

	if ("richText" in value) {
		return value.richText.map((rt: { text: string }) => rt.text).join("")
	}

	if ("text" in value && "hyperlink" in value) {
		return `${value.text} (${value.hyperlink})`
	}

	if ("formula" in value) {
		return formatFormulaCell(value)
	}

	return value.toString()
}

export async function extractTextFromXLSX(filePathOrWorkbook: string | ExcelJS.Workbook): Promise<string> {
	let workbook: ExcelJS.Workbook
	let excelText = ""

	if (typeof filePathOrWorkbook === "string") {
		workbook = new ExcelJS.Workbook()
		await workbook.xlsx.readFile(filePathOrWorkbook)
	} else {
		workbook = filePathOrWorkbook
	}

	workbook.eachSheet((worksheet, sheetId) => {
		if (sheetId > 1) {
			return
		}

		excelText += `Sheet: ${worksheet.name}\n`
		let rowCount = 0

		worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
			if (rowNumber > ROW_LIMIT) {
				return
			}
			const rowText: string[] = []
			rowCount++

			row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
				const cellText = formatCellValue(cell)
				if (cellText) {
					rowText.push(`[${colNumber}] ${cellText}`)
				}
			})

			if (rowText.length > 0) {
				excelText += `Row ${rowNumber}: ${rowText.join(", ")}\n`
			}
		})

		if (rowCount === 0) {
			excelText += "(empty)\n"
		}
	})

	return excelText
}
