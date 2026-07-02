export const MERMAID_THEME = {
	background: "#1e1e1e",
	textColor: "#ffffff",
	mainBkg: "#2d2d2d",
	nodeBorder: "#888888",
	lineColor: "#cccccc",
	primaryColor: "#3c3c3c",
	primaryTextColor: "#ffffff",
	primaryBorderColor: "#888888",
	secondaryColor: "#2d2d2d",
	tertiaryColor: "#454545",
	classText: "#ffffff",
	labelColor: "#ffffff",
	actorLineColor: "#cccccc",
	actorBkg: "#2d2d2d",
	actorBorder: "#888888",
	actorTextColor: "#ffffff",
	fillType0: "#2d2d2d",
	fillType1: "#3c3c3c",
	fillType2: "#454545",
}

export async function svgToPng(svgEl: SVGElement): Promise<string> {
	const svgClone = svgEl.cloneNode(true) as SVGElement
	const viewBox = svgClone.getAttribute("viewBox")?.split(" ").map(Number) || []
	const originalWidth = viewBox[2] || svgClone.clientWidth
	const originalHeight = viewBox[3] || svgClone.clientHeight
	const editorWidth = 3_600
	const scale = editorWidth / originalWidth
	const scaledHeight = originalHeight * scale
	svgClone.setAttribute("width", `${editorWidth}`)
	svgClone.setAttribute("height", `${scaledHeight}`)
	const svgString = new XMLSerializer().serializeToString(svgClone)
	const encodedSvg = encodeURIComponent(svgString).replace(/'/g, "%27").replace(/"/g, "%22")
	const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`
	return new Promise((resolve, reject) => {
		const img = new Image()
		img.onload = () => {
			const canvas = document.createElement("canvas")
			canvas.width = editorWidth
			canvas.height = scaledHeight
			const ctx = canvas.getContext("2d")
			if (!ctx) return reject("Canvas context not available")
			ctx.fillStyle = MERMAID_THEME.background
			ctx.fillRect(0, 0, canvas.width, canvas.height)
			ctx.imageSmoothingEnabled = true
			ctx.imageSmoothingQuality = "high"
			ctx.drawImage(img, 0, 0, editorWidth, scaledHeight)
			resolve(canvas.toDataURL("image/png", 1.0))
		}
		img.onerror = reject
		img.src = svgDataUrl
	})
}
