export const DeleteConfirmDialog = ({
	deleteId,
	onConfirm,
	onCancel,
}: {
	deleteId: string | null
	onConfirm: () => void
	onCancel: () => void
}) =>
	!deleteId ? null : (
		<div
			style={{
				position: "fixed",
				left: 0,
				top: 0,
				right: 0,
				bottom: 0,
				background: "rgba(0,0,0,0.15)",
				zIndex: 9999,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}
			onClick={onCancel}>
			<div
				style={{
					background: "#fff",
					borderRadius: 8,
					boxShadow: "0 2px 16px rgba(0,0,0,0.15)",
					padding: "16px 20px",
					minWidth: 200,
					zIndex: 10000,
				}}
				onClick={(e) => e.stopPropagation()}>
				<div style={{ marginBottom: 12, fontSize: 14, color: "#333" }}>
					Are you sure you want to delete this todo item?
				</div>
				<div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
					<button
						onClick={onCancel}
						style={{
							border: "1px solid #bbb",
							background: "transparent",
							color: "#888",
							borderRadius: 4,
							padding: "2px 10px",
							cursor: "pointer",
							fontSize: 12,
						}}>
						Cancel
					</button>
					<button
						onClick={onConfirm}
						style={{
							border: "1px solid #f14c4c",
							background: "#f14c4c",
							color: "#fff",
							borderRadius: 4,
							padding: "2px 10px",
							cursor: "pointer",
							fontSize: 12,
						}}>
						Delete
					</button>
				</div>
			</div>
		</div>
	)

export const EditToggleButton = ({ isEditing, onToggle }: { isEditing: boolean; onToggle: () => void }) => (
	<button
		onClick={onToggle}
		style={{
			border: isEditing
				? "1px solid var(--vscode-button-border)"
				: "1px solid var(--vscode-button-secondaryBorder)",
			background: isEditing ? "var(--vscode-button-background)" : "var(--vscode-button-secondaryBackground)",
			color: isEditing ? "var(--vscode-button-foreground)" : "var(--vscode-button-secondaryForeground)",
			borderRadius: 4,
			padding: "2px 8px",
			cursor: "pointer",
			fontSize: 13,
			marginLeft: 8,
		}}>
		{isEditing ? "Done" : "Edit"}
	</button>
)
