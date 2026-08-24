import React from "react"
import { observer } from "mobx-react-lite"

import { ModesViewLayout } from "./modes-view/layout/ModesViewLayoutComponent"
import { useModesViewState } from "./modes-view/hooks/useModesViewState"

const ModesView = observer(() => {
	const props = useModesViewState()

	return <ModesViewLayout {...props} />
})

export default ModesView
