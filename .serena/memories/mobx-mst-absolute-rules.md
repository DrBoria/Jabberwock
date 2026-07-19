# MobX-State-Tree (MST) — ABSOLUTE & CATEGORICAL RULES

## Источник истины (Source of Truth)

Вся архитектура фронтенда строится на принципах:

1. https://mobx-state-tree.js.org/compare/context-vs-mst
2. https://mobx-state-tree.js.org/compare/context-reducer-vs-mobx-state-tree

## RULE 1: MST — единственный слой состояния

- ЗАПРЕЩЕНО: `useState` для фиче-состояния, `useReducer`, React Context как store
- Исключение useState: truly local UI (cursor position, hover, focus)
- Всё состояние фич → MST model + actions + views

## RULE 2: Все `vscode.postMessage` ТОЛЬКО внутри MST `.actions()`

- ЗАПРЕЩЕНО в компонентах (даже в колбэках), в хуках, в утилитах, в event-dispatch
- ЕДИНСТВЕННОЕ разрешённое место: `.actions((self) => ({ ... }))` блок MST store
- Каждый action использует `satisfies WebviewToBackend[...][...][...]` для type safety

## RULE 3: Нет props drilling

- Компоненты обязаны быть `observer()` и читать состояние из MST store
- Props только для: refs, style overrides, render props
- Если компоненту нужно 5+ props из родителя — это нарушение

## RULE 4: Нет `any`, `as unknown`, `ts-ignore`, `eslint-disable`

- Используй: `satisfies`, proper generics, `Instance<typeof Store>`
- Исключение: тесты (as any для моков допустимо)

## RULE 5: Computed views заменяют useMemo

- Derived state → в `.views()`.
- `useMemo` в компонентах — только для JSX-мемоизации.

## RULE 6: Типизированные константы

- Event type strings НИКОГДА не хардкодятся
- Все константы из `@jabberwock/types`
- Формат: `CHAT_TASK_NEW_TASK`, `CHAT_MESSAGES_LIST_ASK_RESPONSE`

## Чтение store в компоненте

```typescript
import { observer } from "mobx-react-lite"
import { useChatUI } from "../store"

const MyComponent = observer(() => {
  const store = useChatUI()
  return <div>{store.inputValue}</div>
})
```

```typescript
import { observer } from "mobx-react-lite"
import { useChatUI } from "../store"

const MyComponent = observer(() => {
  const store = useChatUI()
  return <div>{store.inputValue}</div>
})
```
