// Export existing hooks
export { TerminalSizeProvider, useTerminalSize } from "./TerminalSizeContext.js"
export { useToast } from "./ui/index.js"
export { useInputHistory } from "./input/index.js"

// Export new extracted hooks
export { useFollowupCountdown } from "./extension/index.js"
export { useFocusManagement } from "./useFocusManagement.js"
export { useMessageHandlers } from "./extension/index.js"
export { useExtensionHost } from "./extension/index.js"
export { useTaskSubmit } from "./input/index.js"
export { useGlobalInput } from "./input/index.js"
export { usePickerHandlers } from "./input/index.js"

// Export types
export type { UseFollowupCountdownOptions } from "./extension/index.js"
export type { UseFocusManagementOptions, UseFocusManagementReturn } from "./useFocusManagement.js"
export type { UseMessageHandlersOptions, UseMessageHandlersReturn } from "./extension/index.js"
export type { UseExtensionHostOptions, UseExtensionHostReturn } from "./extension/index.js"
export type { UseTaskSubmitOptions, UseTaskSubmitReturn } from "./input/index.js"
export type { UseGlobalInputOptions } from "./input/index.js"
export type { UsePickerHandlersOptions, UsePickerHandlersReturn } from "./input/index.js"
