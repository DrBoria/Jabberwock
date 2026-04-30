import { types, Instance } from "mobx-state-tree"

/**
 * Popup position on screen.
 */
export const PopupPosition = types.model("PopupPosition", {
	x: types.number,
	y: types.number,
})

/**
 * Popup state store — manages popup visibility, position, and content.
 */
export const PopupStore = types
	.model("PopupStore", {
		isVisible: types.optional(types.boolean, false),
		position: types.maybe(PopupPosition),
		content: types.maybe(types.frozen<any>()),
		popupType: types.maybe(types.string),
	})
	.views((self) => ({
		/**
		 * Whether the popup is currently shown.
		 */
		get shown() {
			return self.isVisible
		},

		/**
		 * The current popup content, or null.
		 */
		get currentContent() {
			return self.content ?? null
		},
	}))
	.actions((self) => ({
		/**
		 * Show the popup with the given content and position.
		 */
		show(opts: { content: any; position?: { x: number; y: number }; popupType?: string }) {
			self.isVisible = true
			self.content = opts.content
			self.popupType = opts.popupType ?? null
			if (opts.position) {
				self.position = PopupPosition.create(opts.position)
			} else {
				self.position = undefined
			}
		},

		/**
		 * Hide the popup.
		 */
		hide() {
			self.isVisible = false
			self.content = undefined
			self.position = undefined
			self.popupType = undefined
		},

		/**
		 * Toggle popup visibility.
		 */
		toggle(opts: { content: any; position?: { x: number; y: number }; popupType?: string }) {
			if (self.isVisible) {
				this.hide()
			} else {
				this.show(opts)
			}
		},

		/**
		 * Update the popup position.
		 */
		setPosition(x: number, y: number) {
			if (self.position) {
				self.position.x = x
				self.position.y = y
			} else {
				self.position = PopupPosition.create({ x, y })
			}
		},

		/**
		 * Update the popup content without changing visibility.
		 */
		setContent(content: any) {
			self.content = content
		},
	}))

export function createPopupStore() {
	return PopupStore.create({})
}

export type IPopupStore = Instance<typeof PopupStore>
