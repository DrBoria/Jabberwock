import { MermaidActionButtons } from "../mermaid/MermaidActionButtons"

interface ImageViewerPreviewProps {
	imageUri: string
	alt: string
	className: string
	showControls: boolean
	isHovering: boolean
	copyFeedback: boolean
	imageError: string | null
	imagePath: string | undefined
	onMouseEnter: () => void
	onMouseLeave: () => void
	onOpenInEditor: (e: React.MouseEvent) => void
	onImageError: () => void
	onImageLoad: () => void
	onZoom: (e: React.MouseEvent) => void
	onCopy: (e: React.MouseEvent) => void
	onSave: (e: React.MouseEvent) => void
}

const formatDisplayPath = (path: string): string => {
	if (path.startsWith("./")) return path
	const workspaceMatch = path.match(/\/([^/]+)\/(.+)$/)
	if (workspaceMatch && workspaceMatch[2]) return `./${workspaceMatch[2]}`
	return path.split("/").pop() || path
}

export const ImageViewerPreview: React.FC<ImageViewerPreviewProps> = ({
	imageUri,
	alt,
	className,
	showControls,
	isHovering,
	copyFeedback,
	imageError,
	imagePath,
	onMouseEnter,
	onMouseLeave,
	onOpenInEditor,
	onImageError,
	onImageLoad,
	onZoom,
	onCopy,
	onSave,
}) => (
	<div className={`relative w-full ${className}`} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
		{imageError ? (
			<div
				style={{
					minHeight: "100px",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: "var(--vscode-editor-background)",
					borderRadius: "4px",
					padding: "20px",
				}}>
				<span style={{ color: "var(--vscode-errorForeground)" }}>⚠️ {imageError}</span>
			</div>
		) : (
			<img
				src={imageUri}
				alt={alt}
				className="w-full h-auto rounded cursor-pointer"
				onClick={onOpenInEditor}
				onError={onImageError}
				onLoad={onImageLoad}
				style={{ maxHeight: "400px", objectFit: "contain", backgroundColor: "var(--vscode-editor-background)" }}
			/>
		)}
		{imagePath && (
			<div className="mt-1 text-xs text-vscode-descriptionForeground">{formatDisplayPath(imagePath)}</div>
		)}
		{showControls && isHovering && (
			<div className="absolute bottom-2 right-2 flex gap-1 bg-vscode-editor-background/90 rounded p-0.5 z-10 opacity-100 transition-opacity duration-200 ease-in-out">
				<MermaidActionButtons
					onZoom={onZoom}
					onCopy={onCopy}
					onSave={onSave}
					onViewCode={() => {}}
					copyFeedback={copyFeedback}
				/>
			</div>
		)}
	</div>
)
