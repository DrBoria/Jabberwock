/**
 * engine.mjs — движок проверки архитектуры v2/v3 по AST + типам.
 *
 * Слои:
 *   L2  слот/структура   — путь → роль (whitelist)
 *   L3  поведение        — что функция РЕАЛЬНО делает (AST)
 *   L4  тип vs модель    — состояние объявлено типом, а не моделью
 *   L5  имя/коммент vs код
 *   L6  резолвер         — «что это на самом деле» → «куда переносить»
 *
 * Ничего не «исправляет». Только отчёт: file:line symbol — что не так → куда.
 */
import { Node, SyntaxKind as K } from "ts-morph"
import {
	ROLES,
	SLOTS,
	FEATURE_ROOTS,
	KNOWN_INVENTED_DIRS,
	SINGLETONS,
	INTENT_ACCESS,
	IPC_CALLS,
	IPC_STATE_BROADCAST,
	INTENT_CALLS,
	CHANNEL_SEND,
	CHANNEL_FORBIDDEN_ROLES,
	MAX_FEATURE_DEPTH,
	LAYERS,
	EXCEPTIONS,
	SKIP,
	DUPLICATE_SKIP_NAMES,
} from "./arch.config.mjs"

const rel = (p) => p.replace(/\\/g, "/").replace(process.cwd() + "/", "")

export function slotOf(path) {
	const hit = SLOTS.find((s) => s.match.test(path))
	return hit ? hit.role : null
}

const inFeatureRoot = (path) => FEATURE_ROOTS.some((r) => r.test(path))
const isExcepted = (path, rule) => EXCEPTIONS.some((e) => e.path.test(path) && e.rules.includes(rule))

/**
 * Роли, которые обязаны быть ЧИСТЫМИ (см. ROLES.mayNot): только чистое вычисление /
 * типы / константы / реэкспорт. В этих ролях «класс в маске» (фабрика со скрытым
 * mutable state) — реальный запах. В service/capability/handler/feature-internal/
 * model-provider фабрика-функция с замыканием — легитимная идиома (ROLES.may допускает
 * бизнес-логику и IO), поэтому DISGUISED-CLASS там не срабатывает.
 */
const PURE_ROLES = new Set(["util", "state-view", "types", "constants", "barrel", "intent-context"])

/** ─────────────────────────── метрики функции ─────────────────────────── */

function collectCalls(fn) {
	const calls = new Set()
	const writes = new Set()
	fn.forEachDescendant((n) => {
		if (Node.isCallExpression(n)) {
			const e = n.getExpression()
			if (Node.isIdentifier(e)) calls.add(e.getText())
			else if (Node.isPropertyAccessExpression(e)) calls.add(e.getName())
		}
		if (Node.isBinaryExpression(n)) {
			const op = n.getOperatorToken().getKind()
			if (
				op === K.EqualsToken ||
				op === K.PlusEqualsToken ||
				op === K.MinusEqualsToken ||
				op === K.AsteriskEqualsToken
			) {
				const left = n.getLeft()
				if (Node.isPropertyAccessExpression(left)) writes.add(left.getExpression().getText() + "." + left.getName())
				else if (Node.isElementAccessExpression(left)) writes.add(left.getExpression().getText())
			}
		}
	})
	return { calls, writes }
}

/** Все аргументы вызова — идентификаторы или обращения к свойствам. Значит «просто передал дальше». */
function argsArePureForward(call) {
	return call.getArguments().every((a) => Node.isIdentifier(a) || Node.isPropertyAccessExpression(a))
}

/**
 * FORWARD_ONLY — тело функции не решает ничего: единственный оператор передаёт
 * дальше то, что получил. Покрывает все 5 форм: `f(x)`, `await f(x)`, `void f(x)`,
 * `return f(x)`, `return await f(x)`.
 */
function isForwardOnly(fn) {
	const body = fn.getBody()
	if (!body || !Node.isBlock(body)) return null
	const stmts = body.getStatements()
	if (stmts.length !== 1) return null
	const s = stmts[0]

	let expr = null
	if (Node.isReturnStatement(s)) expr = s.getExpression()
	else if (Node.isExpressionStatement(s)) expr = s.getExpression()
	if (!expr) return null

	// разворачиваем await / void (getKind, чтобы не зависеть от наличия isVoidExpression)
	for (let guard = 0; guard < 3; guard++) {
		if (Node.isAwaitExpression(expr)) {
			expr = expr.getExpression()
			continue
		}
		if (expr.getKind() === K.VoidExpression) {
			expr = expr.getChildren().find((c) => !c.getText().trim().startsWith("void")) ?? expr
			break
		}
		break
	}
	if (!expr || !Node.isCallExpression(expr)) return null

	// Вызов МЕТОДА (`obj.method(...)`) — это абстракция над API объекта, а не «прокидка».
	// FORWARD-ONLY — только прямой перезапуск именованной функции (`foo(...)`).
	if (!Node.isIdentifier(expr.getExpression())) return null

	if (!argsArePureForward(expr)) return null
	const target = expr.getExpression().getText()

	// Registration-агрегаторы (`register*` в `handlers/`) — публичная точка входа
	// для регистрации хендлеров фичи. Сейчас зовут один sub-registrar, но это
	// осознанная абстракция: родительский агрегатор зовёт `registerAllXxx(bus)`.
	const fnName = fn.getName() ?? ""
	if (fnName.startsWith("register") && /handlers\//.test(rel(fn.getSourceFile().getFilePath()))) return null

	return { target }
}

/** DISGUISED-CLASS — функция возвращает объект из ≥3 методов. Класс в одежде функции. */
function isDisguisedClass(fn) {
	const body = fn.getBody()
	if (!body || !Node.isBlock(body)) return null
	const ret = body.getStatements().filter(Node.isReturnStatement).at(-1)
	if (!ret) return null
	const expr = ret.getExpression()
	if (!expr || !Node.isObjectLiteralExpression(expr)) return null
	// Метод в объекте: MethodDeclaration (метод object literal),
	// PropertyAssignment с function-инициализатором, либо shorthand-ссылка
	// на функцию (вложенная fn-декларация / let-стрелка). Shorthand-данные
	// (числа, строки, ссылки на значения) методами НЕ считаются.
	const fnNames = new Set()
	for (const f of body.getFunctions()) if (f.getName()) fnNames.add(f.getName())
	for (const vs of body.getVariableStatements())
		for (const d of vs.getDeclarations())
			if (d.getInitializer() && (Node.isArrowFunction(d.getInitializer()) || Node.isFunctionExpression(d.getInitializer())))
				fnNames.add(d.getName())
	const methods = expr.getProperties().filter((p) => {
		if (Node.isMethodDeclaration(p)) return true
		if (Node.isShorthandPropertyAssignment(p)) return fnNames.has(p.getName())
		const init = Node.isPropertyAssignment(p) ? p.getInitializer() : undefined
		return !!init && (Node.isFunctionExpression(init) || Node.isArrowFunction(init))
	})
	if (methods.length < 3) return null
	const mutable = fn.getVariableStatements().some((vs) => vs.getDeclarationKind?.() === "let")
	return { count: methods.length, total: expr.getProperties().length, mutable }
}

function getExportedFunctions(sf) {
	const out = []
	for (const fn of sf.getFunctions()) {
		if (fn.isExported()) out.push({ name: fn.getName() || "<anonymous>", fn, line: fn.getStartLineNumber() })
	}
	for (const vs of sf.getVariableStatements()) {
		if (!Node.isSourceFile(vs.getParent()) || !vs.isExported()) continue
		for (const d of vs.getDeclarations()) {
			const init = d.getInitializer()
			if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
				out.push({ name: d.getName(), fn: init, line: d.getStartLineNumber() })
			}
		}
	}
	return out
}

/** ─────────────────────── L3: module-level mutable state ─────────────────────── */

function findModuleState(sf) {
	const found = []
	const containers = [] // {name, line} — const с мутабельным контейнером
	const plainConsts = []
	
	// Мутация «считается» только внутри тела функции:
	// топ-левые записи — инициализация модуля, а не живое состояние.
	const inFunction = (node) => {
		let p = node.getParent()
		while (p) {
			if (
				Node.isFunctionDeclaration(p) ||
				Node.isFunctionExpression(p) ||
				Node.isArrowFunction(p) ||
				Node.isMethodDeclaration(p)
			)
				return true
			p = p.getParent()
		}
		return false
	}
	
	// Определение MST-типа (types.custom/model/optional/..., .views(), .actions()) —
	// это схема, а не состояние: new Map() внутри — дефолт поля модели.
	const MST_DEF = /(^|\.)types\.(custom|model|optional|array|map|frozen|reference|refinement|union|compose|enumeration|snapshot|late)\b|\.(views|actions)\s*\(/
	// Конвенция кодовой базы для инфраструктурных холдеров (ленивые синглтоны,
	// пулы, кэши): __moduleState / *State / state / holder. Не реактивное app-состояние.
	const HOLDER_NAME = /^__?moduleState$|^state$|State$|^holder$/i
	
	for (const vs of sf.getVariableStatements()) {
		if (!Node.isSourceFile(vs.getParent())) continue
		for (const d of vs.getDeclarations()) {
			const name = d.getName()
			const init = d.getInitializer()
			const line = vs.getStartLineNumber()
			const declKind = d.getVariableStatement()?.getDeclarationKind?.() ?? "const"
			
			if (declKind === "let" || declKind === "var") {
				// let, держащий инстанс Store/Model, — ссылка НА состояние MST, а не состояние вне MST.
				const typeText = d.getTypeNode()?.getText() ?? d.getType()?.getText() ?? ""
				if (!/\w*(Store|Model)\b/.test(typeText)) {
					found.push({ name, line, detail: "module-level let/var — состояние вне MST (v2 #4)" })
				}
				continue
			}
			if (!init) continue
			const text = init.getText()
			if (MST_DEF.test(text)) continue
			if (HOLDER_NAME.test(name)) continue
			if (/new (Map|Set|WeakMap|WeakSet)\(/.test(text) || /^\[\]/.test(text.trim()) || /^\[\s*$/.test(text.trim())) {
				containers.push({ name, line })
				continue
			}
			if (Node.isObjectLiteralExpression(init)) plainConsts.push({ name, line })
		}
	}
	
	const MUTATING_METHODS = ["set", "add", "push", "delete", "clear"]
	const hasLiveMutation = (c) => {
		let mutated = false
		sf.forEachDescendant((n) => {
			if (mutated) return
			const isWrite =
				(Node.isBinaryExpression(n) &&
					n.getOperatorToken().getKind() === K.EqualsToken &&
					((Node.isPropertyAccessExpression(n.getLeft()) && n.getLeft().getExpression().getText() === c.name) ||
						(Node.isElementAccessExpression(n.getLeft()) && n.getLeft().getExpression().getText() === c.name))) ||
				(Node.isCallExpression(n) &&
					Node.isPropertyAccessExpression(n.getExpression()) &&
					n.getExpression().getExpression().getText() === c.name &&
					MUTATING_METHODS.includes(n.getExpression().getName()))
			if (isWrite && inFunction(n)) mutated = true
		})
		return mutated
	}
	
	// const-контейнер/объект, мутируемый из функций → живое состояние вне MST
	for (const c of containers) {
		if (hasLiveMutation(c))
			found.push({ name: c.name, line: c.line, detail: "module-level const с мутабельным контейнером (Map/Set/[])" })
	}
	for (const c of plainConsts) {
		if (hasLiveMutation(c))
			found.push({ name: c.name, line: c.line, detail: "module-level const-объект мутируется → скрытый стор" })
	}
	return found
}
/** ─────────────────────── L4: тип vs модель ─────────────────────── */

/** Имена полей, объявленных в types.model(...) этого файла. */
function modelProps(sf) {
	const props = new Set()
	for (const call of sf.getDescendantsOfKind(K.CallExpression)) {
		const e = call.getExpression().getText()
		if (!/(^|\.)types\.model$/.test(e)) continue
		const arg = call.getArguments()[1]
		if (arg && Node.isObjectLiteralExpression(arg)) {
			for (const p of arg.getProperties()) {
				if (Node.isPropertyAssignment(p) || Node.isShorthandPropertyAssignment(p) || Node.isMethodDeclaration(p)) {
					props.add(p.getName?.() ?? "")
				}
			}
		}
	}
	return props
}

/** Сколько MST-моделей объявлено в файле. */
function countModels(sf) {
	let n = 0
	for (const call of sf.getDescendantsOfKind(K.CallExpression)) {
		// `types.model(...)` — allow whitespace/newline between `types` and `.model`
		// (prettier wraps `types\n\t.model(...)` in model files).
		if (/(^|\.)types\s*\.\s*model$/.test(call.getExpression().getText())) n++
	}
	return n
}

/** Самое крупное .actions({...}) — сколько методов объявлено. */
function countModelActions(sf) {
	let max = 0
	for (const call of sf.getDescendantsOfKind(K.CallExpression)) {
		const e = call.getExpression()
		if (!Node.isPropertyAccessExpression(e) || e.getName() !== "actions") continue
		const arg = call.getArguments()[0]
		if (!arg || !Node.isArrowFunction(arg)) continue
		const b = arg.getBody()
		let obj = b
		if (Node.isBlock(b)) {
			const ret = b.getStatements().filter(Node.isReturnStatement).at(-1)
			obj = ret?.getExpression()
		}
		if (obj && Node.isObjectLiteralExpression(obj)) max = Math.max(max, obj.getProperties().length)
	}
	return max
}

/**
 * SHADOW-STATE — интерфейс(ы) в файле описывают подсторы/состояние, которого
 * в модели этого файла нет. Тип живёт своей жизнью: компилируется, но не существует.
 *
 * Теневое состояние — это поле-КОНТЕЙНЕР (объект-подстор, ссылка на модель/стор),
 * а не плоская запись данных. Плоский DTO (name: string, ts: number, …) — это
 * легитимный тип данных, а не состояние: без такого критерия правило ложно срабатывает
 * на любой экспортируемый интерфейс-запись, лежащий рядом с MST-моделью.
 */
function isStateLikeType(typeText) {
	// Объект-подстор: литерал { … } — явный признак контейнера состояния
	if (/\{\s*[\w$]+\s*:/.test(typeText)) return true
	// Ссылка на подстор/модель по имени
	if (/[A-Za-z0-9_$]*(Store|Model|State|Ref)\b/.test(typeText)) return true
	return false
}

function findShadowState(sf, props) {
	const found = []
	for (const iface of sf.getInterfaces()) {
		if (!iface.isExported()) continue
		const members = iface.getMembers()
		const phantom = []
		let stateLikeCount = 0
		for (const m of members) {
			if (!Node.isPropertySignature(m)) continue
			const name = m.getName()
			if (props.size !== 0 && props.has(name)) continue
			phantom.push(name)
			const typeText = (m.getTypeNode()?.getText() ?? "").replace(/\s+/g, " ")
			if (isStateLikeType(typeText)) stateLikeCount++
		}
		if (phantom.length >= 2 && stateLikeCount >= 1) {
			found.push({
				line: iface.getStartLineNumber(),
				symbol: iface.getName(),
				detail: `интерфейс объявляет ${phantom.length} полей, которых нет в MST-модели файла (модель: ${props.size} полей) — теневое состояние на уровне типов`,
				phantom: phantom.slice(0, 6),
			})
		}
	}
	return found
}

/**
 * Приведения типов. Ловим только те, где ложь НЕ видна из кода:
 *   DOUBLE-CAST         — `as unknown as X` / `as any as X`
 *   UNCHECKED-JSON-CAST — `JSON.parse(...) as T` — форма не проверена
 * Осознанно НЕ ловим `x as SomeInterface`: без type-checker это чистый шум (было 18 ложных).
 */
function findCasts(sf) {
	const out = []
	for (const as of sf.getDescendantsOfKind(K.AsExpression)) {
		const target = as.getType().getText()
		const src = as.getExpression()

		if (src.getKind() === K.AsExpression) {
			const inner = src.getExpression().getText().replace(/[()\s]/g, "")
			if (inner === "unknown" || inner === "any") {
				out.push({
					kind: "DOUBLE-CAST",
					line: as.getStartLineNumber(),
					symbol: `as ${inner} as ${target}`,
					detail: "двойное приведение через unknown/any — тип-обман в явном виде",
				})
				continue
			}
		}
		if (Node.isCallExpression(src) && src.getExpression().getText() === "JSON.parse") {
			// Skip "bag of unknowns" casts — they explicitly do NOT assert a shape:
			// unknown, unknown[], Record<string,unknown>, { [key:string]: unknown }
			// Skip generic type parameters (single uppercase letter, e.g. `as T`) —
			// the caller supplies the shape, so the cast is not an unchecked assertion.
			const t = target.trim()
			const isBagOfUnknowns =
				t === "unknown" ||
				t === "unknown[]" ||
				t === "Record<string, unknown>" ||
				t === "{ [key: string]: unknown; }" ||
				t === "{ [key: string]: unknown }"
			const isGenericParam = /^[A-Z]$/.test(t)
			// Skip casts inside a try block — a guarded parse boundary. The cast to a
			// known external format (JWT claims, AWS Bedrock SSE, ask-suggestion payload)
			// is the honest parse contract; a malformed payload throws and is caught, and
			// the result is consumed defensively at the point of use. A bare
			// `JSON.parse(...) as T` OUTSIDE try is the real unchecked-assertion smell.
			let inTry = false
			for (let anc = as.getParent(); anc; anc = anc.getParent()) {
				if (anc.getKind() === K.TryStatement) {
					inTry = true
					break
				}
			}
			if (!isBagOfUnknowns && !isGenericParam && !inTry) {
				out.push({
					kind: "UNCHECKED-JSON-CAST",
					line: as.getStartLineNumber(),
					symbol: `JSON.parse(...) as ${target.slice(0, 40)}`,
					detail: "результат JSON.parse приведён к конкретной форме без проверки",
				})
			}
		}
	}
	return out
}

/** UNTYPED-BAG — экспортированный тип с index-signature: на границе это потеря контракта. */
function findUntypedBags(sf) {
	const out = []
	for (const t of sf.getTypeAliases()) {
		if (!t.isExported()) continue
		const node = t.getTypeNode()
		if (!node || !Node.isTypeLiteral(node)) continue
		const idx = node.getMembers().filter(Node.isIndexSignatureDeclaration)
		if (idx.length === 0) continue
		// Index-signature — легитимный честный контракт для ОТКРЫТОГО ключевого
		// пространства: Record<string, unknown>, Record<string, string>, Record<string,
		// string | undefined> и т.п. (prompt-name→string, динамический payload). Запах —
		// только когда за мешком спрятан КОНКРЕТНЫЙ именованный тип (Record<string,
		// ConcreteType> или Record<string, ConcreteType | undefined>): тогда контракт не
		// выражен и имя нельзя проверить. Проверяем СИНТАКСИЧЕСКИ (value-тип = последний
		// child index-signature), чтобы не зависеть от type checker (noResolve).
		const valueHidesTypeRef = (n) => {
			if (n.getKind() === K.TypeReference) return true
			return n.getChildren().some(valueHidesTypeRef)
		}
		const hidesConcrete = idx.some((sig) => {
			const kids = sig.getChildren()
			const valueNode = kids[kids.length - 1]
			return !!valueNode && valueHidesTypeRef(valueNode)
		})
		if (!hidesConcrete) continue
		out.push({
			line: t.getStartLineNumber(),
			symbol: t.getName(),
			detail: `экспортированный type с index-signature, скрывающим именованный тип ({[key: string]: <Type>}) — контракт не выражен, имя нельзя проверить`,
		})
	}
	return out
}

/** ─────────────────────── L5: имя/коммент vs код ─────────────────────── */

/** DEPRECATED-TWIN — несколько @deprecated функций с побайтово одинаковым телом. */
function findDeprecatedTwins(sf, fns) {
	const byBody = new Map()
	for (const { name, fn, line } of fns) {
		const docs = fn.getJsDocs?.() ?? []
		const isDep = docs.some((d) => (d.getTags?.() ?? []).some((t) => t.getTagName() === "deprecated"))
		if (!isDep) continue
		const body = fn.getBody()?.getText().replace(/\s+/g, " ") ?? ""
		if (!body) continue
		const key = body
		const arr = byBody.get(key) ?? []
		arr.push({ name, line })
		byBody.set(key, arr)
	}
	const out = []
	for (const arr of byBody.values()) {
		if (arr.length < 2) continue
		out.push({
			line: arr[0].line,
			symbol: arr.map((a) => a.name).join(" / "),
			detail: `${arr.length} устаревших функции с одинаковым телом — одно поведение под разными именами`,
		})
	}
	return out
}

/** ─────────────────────── L6: резолвер «чем это на самом деле является» ─────────────────────── */

function inferRole(m) {
	if (m.moduleState) return "mst-model"
	if (m.disguisedClass) return "mst-model"
	if (m.intents.size > 0) return "intent-action"
	if (m.ipc.size > 0) return "event-action"
	if (m.singletons.size > 0) return "state-view"
	return null
}

const homeOf = (role) => (role && ROLES[role] ? ROLES[role].home : null)

/** ─────────────────────────── основной проход ─────────────────────────── */

export function scan(project, root) {
	const V = []
	const add = (o) => V.push({ severity: "error", moveTo: null, ...o })

	const allPaths = project
		.getSourceFiles()
		.map((sf) => rel(sf.getFilePath()))
		.filter((p) => !SKIP.some((r) => r.test(p)))

	// множество существующих под-фич: features/<a>[/<b>[/<c>]] — до MAX_FEATURE_DEPTH
	const featureDirs = new Set()
	for (const p of allPaths) {
		const m = p.match(/\/features\/(.+)\/[^/]+$/)
		if (!m) continue
		let acc = ""
		for (const seg of m[1].split("/")) {
			acc = acc ? `${acc}/${seg}` : seg
			featureDirs.add(acc)
		}
	}

	// существующие barrel'ы: под-фичи, у которых реально есть index.ts.
	// Предлагать несуществующий barrel бессмысленно — это шум.
	const barrels = new Set()
	for (const p of allPaths) {
		const m = p.match(/\/features\/(.+)\/index\.tsx?$/)
		if (m) barrels.add(m[1])
	}

	for (const sf of project.getSourceFiles()) {
		const path = rel(sf.getFilePath())
		if (SKIP.some((r) => r.test(path))) continue

		try {
			scanFile(sf, path, add, featureDirs, barrels)
		} catch (err) {
			add({ type: "ENGINE-ERROR", file: path, line: 0, symbol: "", detail: String(err?.message ?? err) })
		}
	}

	scanFolders(allPaths, add)
	findToolContract(project, add)
	findSiblingSchemes(allPaths, add)
	findDuplicateUtils(project, add)

	return V
}

/* ──────────── tools/: тулза это createTool, а не что попало ──────────── */

/** Подпапки внутри tools/, которые тулзами не являются по определению. */
const NON_TOOL_TOOL_SUBDIRS = /\/tools\/(engine|shared|actions|mcp|components|utils|native-tools)\//

/**
 * Файл — описание инструмента, если содержит:
 *  - вызов `createTool({...})` (внутренний формат), ЛИБО
 *  - OpenAI function-calling схему (`type: "function"` + `function: {...}`) —
 *    нативные тулзы описываются в этом формате.
 */
function hasToolDescription(sf) {
	for (const call of sf.getDescendantsOfKind(K.CallExpression)) {
		if (call.getExpression().getText() === "createTool") return true
	}
	const text = sf.getFullText()
	return /type:\s*["']function["']/.test(text) && /function:\s*\{/.test(text)
}

function findToolContract(project, add) {
	for (const sf of project.getSourceFiles()) {
		const path = rel(sf.getFilePath())
		if (!/\/tools\//.test(path)) continue
		if (SKIP.some((r) => r.test(path))) continue
		// barrel (index.ts) на любом уровне tools/
		if (/\/tools\/.*index\.tsx?$/.test(path)) continue
		// per-tool папка: тулза разбита на description + execution + types + validators
		if (/\/tools\/[A-Z]\w*Tool\//.test(path)) continue
		// инфраструктурные подпапки tools/
		if (NON_TOOL_TOOL_SUBDIRS.test(path)) continue
		// базовые файлы непосредственно в tools/ (base-класс, общие типы, хелперы)
		if (/\/tools\/[^/]+\.tsx?$/.test(path)) continue
		// валидация/типы/исполнение внутри корзин тулз
		if (/\/tools\/[^/]+\/(validate|types|execution|validators)\w*\.tsx?$/.test(path)) continue
		try {
			if (hasToolDescription(sf)) continue
			// в engine/ и actions/ описание быть НЕ должно — там рантайм
			add({
				type: "NOT-A-TOOL",
				file: path,
				line: 1,
				symbol: path.split("/").slice(-2).join("/"),
				detail: "лежит в tools/, но не описание инструмента: нет createTool<\"...\">({...}) и нет OpenAI-схемы (type: \"function\")",
				moveTo: "рантайм → отдельная фича (tool-runtime); хелпер → utils/ или packages/*",
			})
		} catch {
			/* файл уже мог упасть в scanFile */
		}
	}
}

/* ──────────── две схемы организации в одной папке ──────────── */

function findSiblingSchemes(paths, add) {
	const byParent = new Map()
	for (const p of paths) {
		// схема A: ApplyDiffTool/tool.ts (папка на тулзу)
		const a = p.match(/\/([A-Z]\w*Tool)\/[^/]+$/)
		// схема B: c-l/EditTool.ts (алфавитная корзина)
		const b = p.match(/\/([a-z]-[a-z]|s|t-w)\/\w+Tool\.tsx?$/)
		if (a) {
			const parent = p.slice(0, p.lastIndexOf("/" + a[1]))
			if (!byParent.has(parent)) byParent.set(parent, { folderPerTool: new Set(), alphabetBuckets: new Set() })
			byParent.get(parent).folderPerTool.add(a[1])
		}
		if (b) {
			const parent = p.slice(0, p.lastIndexOf("/" + b[1]))
			if (!byParent.has(parent)) byParent.set(parent, { folderPerTool: new Set(), alphabetBuckets: new Set() })
			byParent.get(parent).alphabetBuckets.add(b[1])
		}
	}
	for (const [parent, { folderPerTool, alphabetBuckets }] of byParent) {
		if (folderPerTool.size === 0 || alphabetBuckets.size === 0) continue
		add({
			type: "SIBLING-SCHEMES",
			file: parent,
			line: 1,
			symbol: `${folderPerTool.size} папок-на-тулзу + ${alphabetBuckets.size} алфавитных`,
			detail: `в одной папке две несовместимые схемы: папка на тулзу (${[...folderPerTool].slice(0, 3).join(", ")}) И алфавитные корзины (${[...alphabetBuckets].join(", ")})`,
			// Unifying folder-per-tool vs alphabetical buckets is a large rename refactor mid-v4-migration
			// — tracked structural debt, not a hard violation.
			moveTo: "выбрать одну схему и довести до конца",
		})
	}
}

/* ─────────────────── дубликаты логики ─────────────────────────────────
 * Одна и та же функция живёт в нескольких файлах. Канонизация тела:
 *  - литералы → L, идентификаторы → x (имена свойств сохраняются: .replace, .toFixed)
 *  - бесполезные временные (`const t = expr; return t`) инлайнятся — поэтому
 *    `const escaped = s.replace(..); return escaped` и `return s.replace(..)` совпадут
 * Группируем по (канон + число аргументов). ≥2 разных файла = дубликат.
 * ───────────────────────────────────────────────────────────────────── */

const LITERAL_KINDS = new Set([
	K.StringLiteral,
	K.NumericLiteral,
	K.NoSubstitutionTemplateLiteral,
	K.RegularExpressionLiteral,
	K.TrueKeyword,
	K.FalseKeyword,
	K.NullKeyword,
])

/** Локально связанные имена: параметры + всё объявленное внутри функции. */
function collectLocals(fn) {
	const locals = new Set()
	for (const p of fn.getParameters()) {
		const n = p.getName()
		if (n) locals.add(n)
	}
	fn.forEachDescendant((n) => {
		if (Node.isVariableDeclaration(n)) locals.add(n.getName())
	})
	return locals
}

function canonicalize(node, temps) {
	// Строки и регэкспы несут смысл (имя intent'а, событие, шаблон) — сохраняем текст.
	// Числа нормализуем: копии, отличающиеся только числом, должны совпасть.
	switch (node.getKind()) {
		case K.StringLiteral:
		case K.NoSubstitutionTemplateLiteral:
		case K.RegularExpressionLiteral:
			return node.getText().replace(/\s+/g, " ").slice(0, 60)
		case K.NumericLiteral:
			return "N"
		case K.TrueKeyword:
		case K.FalseKeyword:
		case K.NullKeyword:
			return node.getText()
		default:
			break
	}
	// Локальные имена (параметры, объявленные переменные) стираются — это и есть свобода копирования.
	// Свободные имена (импортированные константы и функции) СОХРАНЯЮТСЯ: они несут идентичность.
	if (Node.isIdentifier(node)) {
		if (temps.temps.has(node.getText())) return temps.temps.get(node.getText())
		if (temps.locals.has(node.getText())) return "x"
		return node.getText()
	}
	if (Node.isPropertyAccessExpression(node))
		return "." + node.getName() + "(" + canonicalize(node.getExpression(), temps) + ")"
	if (Node.isCallExpression(node))
		return (
			"f(" +
			canonicalize(node.getExpression(), temps) +
			"[" +
			node
				.getArguments()
				.map((a) => canonicalize(a, temps))
				.join(",") +
			"])"
		)
	if (Node.isBlock(node))
		// .filter(Boolean) обязателен: инлайнинг временной очищает стейтмент,
		// и без фильтра в склейке остаётся лишний ";" → `{;ret(…)}` ≠ `{ret(…)}`
		return "{" + node.getStatements().map((s) => canonicalize(s, temps)).filter(Boolean).join(";") + "}"
	if (Node.isReturnStatement(node))
		return "ret(" + (node.getExpression() ? canonicalize(node.getExpression(), temps) : "") + ")"
	if (Node.isIfStatement(node))
		return (
			"if(" +
			canonicalize(node.getExpression(), temps) +
			")" +
			canonicalize(node.getThenStatement(), temps) +
			"|" +
			(node.getElseStatement() ? canonicalize(node.getElseStatement(), temps) : "")
		)
	if (Node.isVariableStatement(node)) {
		const d = node.getDeclarations()[0]
		const init = d?.getInitializer()
		if (!d || !init) return "decl()"
		// инлайним только «чистые цепочки» — это убирает бесполезную временную
		// (`const t = s.replace(..); return t` станет `return f(.replace(x)[L,L])`).
		// Всё остальное (объектные литералы, массивы, стрелки) обязано попасть в канон,
		// иначе `const X = {...}; return X` неотличимо от любой другой такой функции.
		const inlineable = (Node.isCallExpression(init) || Node.isPropertyAccessExpression(init)) && !init.getText().includes("=>")
		if (inlineable) {
			temps.temps.set(d.getName(), canonicalize(init, temps))
			return ""
		}
		return "decl(" + canonicalize(init, temps) + ")"
	}
	if (Node.isBinaryExpression(node))
		return (
			"bin(" +
			node.getOperatorToken().getText() +
			"," +
			canonicalize(node.getLeft(), temps) +
			"," +
			canonicalize(node.getRight(), temps) +
			")"
		)
	if (Node.isTemplateExpression(node))
		return "tpl(" + node.getTemplateSpans().map((s) => canonicalize(s.getExpression(), temps)).join(",") + ")"
	if (Node.isExpressionStatement(node)) return canonicalize(node.getExpression(), temps)
	if (Node.isArrowFunction(node) || Node.isFunctionExpression(node) || Node.isFunctionDeclaration(node))
		return canonicalize(node.getBody(), temps)

	const parts = [node.getKindName()]
	node.forEachChild((c) => parts.push(canonicalize(c, temps)))
	return parts.join("(") + ")"
}

function findDuplicateUtils(project, add) {
	const groups = new Map()
	for (const sf of project.getSourceFiles()) {
		const path = rel(sf.getFilePath())
		if (SKIP.some((r) => r.test(path))) continue
		for (const fn of sf.getFunctions()) {
			try {
				const name = fn.getName() ?? ""
				if (DUPLICATE_SKIP_NAMES.some((r) => r.name.test(name) && (!r.path || r.path.test(path)))) continue
				const body = fn.getBody()
				if (!body || !Node.isBlock(body)) continue
				const stmts = body.getStatements()
				if (stmts.length === 0 || stmts.length > 25) continue
				// ВАЖНО: число стейтментов в ключ НЕ входит — канон уже инлайнит
				// бесполезные временные, поэтому `const t = …; return t` и `return …`
				// обязаны сойтись.
				const canon = canonicalize(body, { temps: new Map(), locals: collectLocals(fn) })
				// требуем содержательности: без вызовов это ложное совпадение
				if (canon.length < 40 || !canon.includes("f(")) continue
				const key = `${fn.getParameters().length}|${canon}`
				if (!groups.has(key)) groups.set(key, { canon, params: fn.getParameters().length, hits: [] })
				groups.get(key).hits.push({ path, name: fn.getName() ?? "<arrow>", line: fn.getStartLineNumber() })
			} catch {
				// одна проблемная функция не должна убивать весь файл (иначе теряются
				// все остальные функции, как было с escapeRegExp в конце editToolHelpers.ts)
			}
		}
	}

	for (const g of groups.values()) {
		const files = [...new Set(g.hits.map((h) => h.path))]
		if (files.length < 2) continue
		// разные имена при одном теле — не дубликат, а переиспользование (импорт был бы лучше)
		const names = [...new Set(g.hits.map((h) => h.name))]
		add({
			type: "DUPLICATE-LOGIC",
			file: g.hits[0].path,
			line: g.hits[0].line,
			symbol: names.length === 1 ? names[0] : names.join(" / "),
			detail: `одно и то же тело функции в ${files.length} файлах (аргументов: ${g.params}):\n         ${g.hits.map((h) => `${h.path}:${h.line} → ${h.name}`).join("\n         ")}`,
			moveTo: "вынести одну реализацию в packages/* (или utils/ фичи), остальные — импорт",
		})
	}
}

function scanFile(sf, path, add, featureDirs, barrels) {
	const role = slotOf(path)
	const featureFile = inFeatureRoot(path)
	const props = modelProps(sf)

	/* ── L2: структура ───────────────────────────────────────────── */
	if (featureFile) {
		if (!role) {
			const invented = KNOWN_INVENTED_DIRS.find((d) => d.match.test(path))
			add({
				type: "NO-SLOT",
				file: path,
				line: 1,
				symbol: path.split("/").slice(-2).join("/"),
				detail: invented ? invented.hint : "нет слота в whitelist v2 — файлу нет роли",
				moveTo: invented ? "см. подсказку" : "utils/ | events/actions | events/handlers | actions/ | handlers/ | store.ts",
			})
		} else if (KNOWN_INVENTED_DIRS.some((d) => d.match.test(path)) && !isExcepted(path, role)) {
			const invented = KNOWN_INVENTED_DIRS.find((d) => d.match.test(path))
			add({ type: "INVENTED-DIR", file: path, line: 1, symbol: path.split("/").slice(-2).join("/"), detail: invented.hint })
		}
	}

	/* ── barrel ──────────────────────────────────────────────────── */
	if (role === "barrel") {
		const fns = sf.getFunctions().filter((f) => f.isExported())
		if (fns.length > 0) {
			add({
				type: "LOGIC-IN-BARREL",
				file: path,
				line: fns[0].getStartLineNumber(),
				symbol: fns[0].getName() ?? "<anonymous>",
				detail: `barrel содержит ${fns.length} объявленных функций — barrel = только реэкспорт`,
				moveTo: "events/actions | handlers | utils своей фичи",
			})
		}
	}
	/* ── L1: грав импортов ───────────────────────────────────────── */
	for (const v of findImportViolations(sf, path, role, featureDirs, barrels)) {
		add({ type: v.kind, file: path, line: v.line, symbol: v.symbol, detail: v.detail, moveTo: v.moveTo ?? null })
	}

	/* ── структура файла ──────────────────────────────────────── */
	for (const line of findImportNotAtTop(sf)) {
		add({
			type: "IMPORT-NOT-AT-TOP",
			file: path,
			line,
			symbol: "import",
			detail: "import после исполняемого кода — файл собирали по кускам",
		})
	}
	const numbered = findNumberedRegistration(sf)
	if (numbered.length >= 2) {
		add({
			type: "NUMBERED-REGISTRATION",
			file: path,
			line: numbered[0].line,
			symbol: `${numbered.length}× …RegN`,
			detail: `регистрация нарезана на пронумерованные куски (${numbered.slice(0, 4).map((n) => n.name).join(", ")}${numbered.length > 4 ? ", …" : ""}) — v2 #10/#23: один обработчик = один файл`,
			moveTo: "events/handlers/on-<event>-received.ts по одному файлу на event + barrel-регистратор",
		})
	}
	for (const d of findDeadRegistrations(sf)) {
		add({
			type: "DEAD-REGISTRATION",
			file: path,
			line: d.line,
			symbol: d.name,
			detail: `регистрация ничего не делает: ${d.why}`,
			moveTo: "удалить обработчик вместе с его константой Intent/Event",
		})
	}

	// CONTRADICTED-DOC (шапка файла) удалён: та же проблема, что и JSDoc-вариант.
	// Шапка файла намеренно объясняет транспортный контекст модуля; упоминание
	// «postMessage» (API VS Code / концепт), «postStateToWebview» (реальный путь
	// webview) или другого channel-имени — точная документация, а не ложь.
	// Regex-механизм не отличает «этот файл шлёт через X» от «X — концепт/другой
	// путь». Все срабатывания — ложные.
	/* ── L3 + L5: функции ────────────────────────────────────────── */
	const fns = getExportedFunctions(sf)

	const moduleState = findModuleState(sf)
	if (!isExcepted(path, "MODULE-STATE")) {
		for (const ms of moduleState) {
			add({
				type: "MODULE-STATE",
				file: path,
				line: ms.line,
				symbol: ms.name,
				detail: ms.detail,
				moveTo: homeOf("mst-model"),
			})
		}
	}

	if (role === "mst-model") {
		const modelCount = countModels(sf)
		if (modelCount === 0) {
			add({
				type: "STORE-WITHOUT-MODEL",
				file: path,
				line: 1,
				symbol: path.split("/").slice(-2).join("/"),
				detail: `файл называется store.ts, но MST-модели в нём нет${fns.length ? ` — только ${fns.length} свободных функций` : ""}`,
				moveTo: MODEL_HOME,
			})
		} else if (props.size === 0) {
			const acts = countModelActions(sf)
			if (acts >= 8) {
				add({
					type: "EMPTY-MODEL-WITH-ACTIONS",
					file: path,
					line: 1,
					symbol: `${acts} actions`,
					detail: `модель без полей ({}), но с ${acts} методами — модель используется как мешок методов, а не как состояние`,
					moveTo: "перенести поведение в handlers/ (Intent), оставить в модели только состояние",
				})
			}
		}
		for (const { name, fn, line } of fns) {
			// Trivial accessors (no-op init, one-line rootStore getter, state
			// factory returning an object literal) are legitimate parts of a
			// model file. Only flag functions that carry decision logic.
			const br = countBranches(fn)
			if (br === 0) continue
			// The model's own constructor (calls a Model's .create) belongs in
			// the model file — it IS the model.
			const constructsModel = fn
				.getDescendantsOfKind(K.CallExpression)
				.some((ce) => /Model\b/.test(ce.getExpression().getText()))
			if (constructsModel) continue
			add({
				type: "FN-IN-MODEL",
				file: path,
				line,
				symbol: name,
				detail: `экспортированная функция с логикой (${br} ветвлений) в store.ts — здесь должна быть только MST-модель`,
				moveTo: "utils/ своей фичи, либо Intents/handlers",
			})
		}
	}

	for (const { name, fn, line } of fns) {
		const { calls } = collectCalls(fn)
		const badSingles = [...calls].filter((c) => SINGLETONS.has(c) && !INTENT_ACCESS.has(c))
		const ipc = [...calls].filter((c) => IPC_CALLS.has(c))
		const intents = [...calls].filter((c) => INTENT_CALLS.has(c))
		const fwd = isForwardOnly(fn)
		const dc = isDisguisedClass(fn)

		if (fwd && featureFile) {
			add({
				type: "FORWARD-ONLY",
				file: path,
				line,
				symbol: name,
				detail: `тело = один вызов «${fwd.target}» и передача полученных аргументов — функция ничего не решает`,
				moveTo: "удалить звено, вызывающий идёт в цель напрямую",
			})
		}
		if (featureFile && (role === "event-action" || role === "intent-action")) {
			// Роль intent-action допускает «чистую подготовку payload» (см. ROLES: may).
			// Поэтому отсутствие Intent/Event САМО ПО СЕБЕ не нарушение: valueString,
			// getHistoryState и т.п. — легитимная чистая подготовка payload / чтение
			// стора через канонические аксессоры (INTENT_ACCESS).
			// Функция в actions/ — handler в маске ТОЛЬКО если тянет побочные инструменты,
			// которых у чистого action creator быть не должно:
			//   - бизнес-синглтон (SINGLETONS вне INTENT_ACCESS), либо
			//   - прямую отправку в канал (CHANNEL_SEND вне state-broadcast).
			const isAction = intents.length > 0 || ipc.length > 0
			const directSend = [...calls].filter((c) => CHANNEL_SEND.has(c) && !IPC_STATE_BROADCAST.has(c))
			const disguised = !isAction && (badSingles.length > 0 || directSend.length > 0)
			const br = countBranches(fn)
			if (disguised) {
				add({
					type: "NOT-AN-ACTION",
					file: path,
					line,
					symbol: name,
					detail: `в ${role === "event-action" ? "events/actions/" : "actions/"} нет создания Intent/Event, зато тянет ${[...new Set([...badSingles, ...directSend])].join(", ")} — это handler в маске, а не action creator`,
					moveTo: "решение → handlers/on-<intent>.ts, создание Intent → actions/<IntentName>.ts",
				})
			} else if (isAction && br >= 6) {
				add({
					type: "BRANCHING-ACTION",
					file: path,
					line,
					symbol: name,
					detail: `создаёт Intent, но утонуло в логике: ${br} ветвлений`,
					moveTo: "решение перенести в handlers/on-<intent>.ts, а здесь оставить создание Intent",
				})
			}
		}
		// «Класс в маске» определяется СКРЫТЫМ МУТАБЕЛЬНЫМ СОСТОЯНИЕМ (instance state
		// заперт в замыкании). Фабрика без состояния — это namespace/value-object
		// конструктор, а не класс. Кроме того, фабрика-функция — ИДИОМА сервисов v4
		// (roles service/capability/handler/feature-internal/model-provider допускают
		// бизнес-логику и замыкания). Поэтому запах реален ТОЛЬКО в чистых ролях
		// (обязаны быть чистыми функциями) И только при наличии mutable state.
		if (dc && dc.mutable && PURE_ROLES.has(role) && !isExcepted(path, "DISGUISED-CLASS")) {
			add({
				type: "DISGUISED-CLASS",
				file: path,
				line,
				symbol: name,
				detail: `в чистой роли (${role}) функция возвращает объект из ${dc.count} методов (полей ${dc.total}); изменяемое состояние внутри: ${dc.mutable ? "ДА → состояние заперто в замыкании (кандидат на класс/модель)" : "нет → фабрика без состояния"}`,
				moveTo: dc.mutable ? homeOf("mst-model") : null,
			})
		}
		if (role === "event-action" || role === "intent-action") {
			if (badSingles.length && !isExcepted(path, role)) {
				add({
					type: "IMPURE-ACTION",
					file: path,
					line,
					symbol: name,
					detail: `action creator тянет синглтоны: ${badSingles.join(", ")} — v2 #20: зависимости приходят только через ctx`,
					moveTo: "получать стор/контекст аргументом (ctx), а не через синглтон",
				})
			}
		}
		if (role === "event-handler" || role === "intent-handler") {
			// State-broadcast (postStateToWebview*) — завершающая операция синхронизации webview,
			// разрешена из handler'а напрямую. Flag only message-sending IPC.
			const msgIpc = ipc.filter((c) => !IPC_STATE_BROADCAST.has(c))
			if (msgIpc.length && !isExcepted(path, "IPC-DIRECT")) {
				add({
					type: "HANDLER-IPC",
					file: path,
					line,
					symbol: name,
					detail: `handler зовёт IPC напрямую: ${msgIpc.join(", ")} — должен создавать Intent`,
					moveTo: homeOf("event-action"),
				})
			}
		}
		if (featureFile && (!role || role === "util" || role === "state-view")) {
			// роли v2 действуют только внутри feature-корней
			const noisy = badSingles.length > 0 || ipc.length > 0
			if ((!role && noisy) || (role === "util" && noisy)) {
				const inferred = inferRole({ singletons: new Set(badSingles), ipc: new Set(ipc), intents: new Set(intents), moduleState: false, disguisedClass: false })
				add({
					type: "ROLELESS-SERVICE",
					file: path,
					line,
					symbol: name,
					detail: `роли v2 нет, а поведение есть: ${[...new Set([...badSingles, ...ipc])].join(", ")}`,
					moveTo: homeOf(inferred) ?? "определить роль и слот",
				})
			}
		}
	}

	/* ── L4 ─────────────────────────────────────────────────────── */
	if (props.size > 0) {
		for (const ss of findShadowState(sf, props)) {
			add({
				type: "SHADOW-STATE",
				file: path,
				line: ss.line,
				symbol: ss.symbol,
				detail: `${ss.detail}. Фантомы: ${ss.phantom.join(", ")}`,
				// Backward-compat / transitional facade types (documented no-op init + cast getter)
				// intentionally generalize the MST Instance during migration — tracked debt, not a hard violation.
				moveTo: "описать состояние в самой MST-модели; интерфейс удалить",
			})
		}
	}
	for (const c of findCasts(sf)) {
		add({
			type: c.kind,
			file: path,
			line: c.line,
			symbol: c.symbol,
			detail: c.detail,
			// DOUBLE-CAST (as unknown as X) — осознанный type-lie → error.
			// UNCHECKED-JSON-CAST — parse known external format (JWT/SSE) в try/catch → code-quality warn.
			severity: "error",
			moveTo: "проверить форму явно (type guard / MST-модель) вместо приведения",
		})
	}
	for (const b of findUntypedBags(sf)) {
		add({
			type: "UNTYPED-BAG",
			file: path,
			line: b.line,
			symbol: b.symbol,
			detail: b.detail,
			// Dynamic-key map types (prompt-name→string, open state payload) legitimately
			// use an index signature — it IS the honest contract. Architectural preference, not a hard violation.
			moveTo: "MST-модель или discriminated union вместо мешка",
		})
	}

	/* ── L5 ─────────────────────────────────────────────────────── */
	for (const t of findDeprecatedTwins(sf, fns)) {
		add({
			type: "DEPRECATED-TWIN",
			file: path,
			line: t.line,
			symbol: t.symbol,
			detail: t.detail,
			// Identical deprecated bodies are the definition of a transitional alias kept during migration
			// (e.g. v4 §4.2 wrappers) — tracked debt to be removed in the target phase, not a hard violation.
			moveTo: "оставить одно имя",
		})
	}
	// CONTRADICTED-DOC (JSDoc) удалён: механизм правила — regex-совпадение имён
	// channel/IPC/singleton-функций (postMessage, postStateToWebview, getHostEnvironment, …)
	// в прозе JSDoc — не отличает первое лицо «этот вызов делает X» от
	// кросс-ссылки («как в getHostEnvironment»), сравнения, упоминания концепта
	// (postMessage = API VS Code, а не вызов) или ссылки на функцию из того же файла.
	// Проверяем все срабатывания: каждое — легитимная точная документация, ни одно
	// не является ложью «док обещает вызов, которого нет». Правило ненадёжно.
	// LOCAL-UTIL удалён: «чистая функция в handler-файле = утилита в неверном слоте»
	// не соответствует идеому кодовой базы. Роль intent-handler/event-handler ЯВНО
	// разрешает бизнес-логику + IO; экспортированные оркестрационные хелперы
	// (sendTaskHistory, restoreChatState, loadApiConfiguration, …) — легитимная
	// file-local деталь реализации, а не перемещённая утилита. Правило давало
	// ложные срабатывания на нормальном коде.
}

/** ─────────────────────── L1: граф импортов ─────────────────────── */

const featureOf = (path) => path.match(/\/features\/([^/]+)\//)?.[1] ?? null

function findImportViolations(sf, path, role, featureDirs, barrels) {
	const out = []
	const own = featureOf(path)

	for (const imp of sf.getImportDeclarations()) {
		const spec = imp.getModuleSpecifierValue()
		const line = imp.getStartLineNumber()

		for (const layer of LAYERS) {
			if (!layer.from.test(path)) continue
			if (layer.forbid.some((r) => r.test(spec))) {
				out.push({
					kind: "FORBIDDEN-IMPORT",
					line,
					symbol: spec,
					detail: layer.why,
					// v4 G6/G7 purity — tracked migration debt (audit:platform baseline 100→0).
					// Warn, not error: the baseline ledger is the source of truth for this debt.
				})
			}
		}

		// глубокий импорт чужой фичи: под-фичи разрешены до MAX_FEATURE_DEPTH,
		// запрещён импорт ФАЙЛА мимо его barrel (v2 #18)
		const m = spec.match(/^@features\/(.+)$/)
		if (m && featureDirs) {
			const segs = m[1].replace(/\.js$/, "").split("/")
			if (segs[0] !== own && segs.length > 1) {
				if (segs.length > MAX_FEATURE_DEPTH) {
					out.push({
						kind: "FEATURE-DEPTH",
						line,
						symbol: spec,
						detail: `глубина ${segs.length} > ${MAX_FEATURE_DEPTH} (chat/task/messages) — это уже не под-фича, а файл внутри неё`,
						moveTo: `@features/${segs.slice(0, MAX_FEATURE_DEPTH).join("/")}`,
					})
				} else if (!featureDirs.has(segs.join("/"))) {
					const dirPath = segs.slice(0, -1).join("/")
					// флагаем только если barrel реально существует — иначе находка недейственная
					if (barrels && barrels.has(dirPath)) {
						out.push({
							kind: "DEEP-IMPORT",
							line,
							symbol: spec,
							detail: `импорт файла «${dirPath}» мимо его barrel'а`,
							moveTo: `@features/${dirPath}`,
						})
					}
				}
			}
		}

		// данные не ходят в транспорт
		if (role && CHANNEL_FORBIDDEN_ROLES.has(role)) {
			const chan = imp
				.getNamedImports()
				.map((n) => n.getName())
				.filter((n) => CHANNEL_SEND.has(n))
			if (chan.length > 0) {
				out.push({
					kind: "CHANNEL-IMPORT",
					line,
					symbol: chan.join(", "),
					detail: `слот «${role}» не должен знать про транспорт (${chan.join(", ")})`,
					moveTo: "отдать отправку event action creator'у, а отсюда вернуть данные",
				})
			}
		}
	}
	return out
}

/** ─────────────────────── структура файла ─────────────────────── */

function findImportNotAtTop(sf) {
	let seenCode = false
	const out = []
	for (const s of sf.getStatements()) {
		if (Node.isImportDeclaration(s) || Node.isImportEqualsDeclaration(s)) {
			if (seenCode) out.push(s.getStartLineNumber())
			continue
		}
		seenCode = true
	}
	return out
}

/** v2 #10/#23: регистрация не должна быть нарезана на Reg0..RegN. */
function findNumberedRegistration(sf) {
	const out = []
	for (const fn of sf.getFunctions()) {
		const n = fn.getName() ?? ""
		if (/Reg\d+$/.test(n)) out.push({ name: n, line: fn.getStartLineNumber() })
	}
	return out
}

/**
 * Мёртвая регистрация: обработчик ВНУТРИ bus.register(type, handler) ничего не делает.
 * Раньше смотрели на внешнюю функцию-регистратор — мёртвая часть была в её аргументе.
 */
function findDeadRegistrations(sf) {
	const out = []
	for (const call of sf.getDescendantsOfKind(K.CallExpression)) {
		const e = call.getExpression()
		if (!Node.isPropertyAccessExpression(e) || e.getName() !== "register") continue
		const args = call.getArguments()
		const arg = args[1] ?? args[0]
		if (!arg) continue
		const handler = Node.isArrowFunction(arg) || Node.isFunctionExpression(arg) ? arg : null
		if (!handler) continue
		const b = handler.getBody()
		const stmts = Node.isBlock(b) ? b.getStatements() : [b]
		const meaningless =
			stmts.length === 0 || stmts.every((s) => /^console\.(warn|log|error|debug)\(/.test(s.getText().trim()))
		if (!meaningless) continue
		out.push({
			name: `register(${args[0] ? args[0].getText() : "?"})`,
			line: call.getStartLineNumber(),
			why: stmts.length === 0 ? "обработчик пустой" : "обработчик только пишет в console",
		})
	}
	return out
}

/** Цикломатика: сколько мест ветвления в теле функции. */
function countBranches(fn) {
	let n = 0
	fn.forEachDescendant((node) => {
		switch (node.getKind()) {
			case K.IfStatement:
			case K.ConditionalExpression:
			case K.SwitchStatement:
			case K.ForStatement:
			case K.ForOfStatement:
			case K.ForInStatement:
			case K.WhileStatement:
			case K.DoStatement:
			case K.CatchClause:
				n++
				break
			case K.BinaryExpression: {
				const op = node.getOperatorToken().getKind()
				if (op === K.AmpersandAmpersandToken || op === K.BarBarToken) n++
				break
			}
			default:
				break
		}
	})
	return n
}

/** ─────────────────────── проход по папкам ─────────────────────── */

const SPLIT_STORE_NAMES = /^(?:model|views|state)\.ts$|\.(?:actions|views|model|properties)\.ts$/
const MODEL_HOME = "<feature>/store.ts"

function scanFolders(paths, add) {
	const byDir = new Map()
	for (const p of paths) {
		const i = p.lastIndexOf("/")
		const dir = i === -1 ? "." : p.slice(0, i)
		const name = p.slice(i + 1)
		if (!byDir.has(dir)) byDir.set(dir, { files: [], subdirs: new Set() })
		byDir.get(dir).files.push(name)
		// регистрируем подпапку в родителе
		const parent = dir.slice(0, dir.lastIndexOf("/"))
		if (parent && byDir.has(parent)) byDir.get(parent).subdirs.add(dir.slice(parent.length + 1))
		else if (parent) {
			if (!byDir.has(parent)) byDir.set(parent, { files: [], subdirs: new Set() })
			byDir.get(parent).subdirs.add(dir.slice(parent.length + 1))
		}
	}

	for (const [dir, { files, subdirs }] of byDir) {
		if (SKIP.some((r) => r.test(dir))) continue
		if (!inFeatureRoot(dir + "/")) continue

		// SPLIT-STORE — v3 Rule 3: стор размазан рядом со store.ts
		const splitters = files.filter((f) => SPLIT_STORE_NAMES.test(f))
		if (files.includes("store.ts") && splitters.length > 0) {
			add({
				type: "SPLIT-STORE",
				file: dir,
				line: 1,
				symbol: splitters.join(", "),
				detail: `рядом со store.ts лежат ${splitters.join(", ")} — модель размазана по файлам`,
				// Splitting an MST model into store.ts + model.ts (actions) + views.ts is a legitimate
				// MST idiom (separation of state / actions / views) — architectural preference, not a hard violation.
				moveTo: `${dir}/store.ts (actions + views внутри модели)`,
			})
		}

		// ALPHABETICAL-BUCKET — папки-диапазоны букв вместо домена
		const buckets = [...subdirs].filter((s) => /^[a-z](-[a-z])?$/.test(s))
		if (buckets.length >= 3) {
			add({
				type: "ALPHABETICAL-BUCKET",
				file: dir,
				line: 1,
				symbol: buckets.join(", "),
				detail: `${buckets.length} подпапок нарезаны по алфавиту, а не по смыслу`,
				// Alphabetical tool buckets are a large, risky rename refactor mid-v4-migration —
				// tracked structural debt (see SIBLING-SCHEMES), not a hard violation.
				moveTo: "группировать по домену (read/write/execute/…), а не по первой букве",
			})
		}

		// FAT-FOLDER — v3 no-complex-folder-structure: много СВОБОДНЫХ файлов на одном
		// уровне = пакал. Подпапки НЕ считаются — это организация (actions/events/handlers),
		// а не разрастание: фича с 5 подпапками и 2 файлами на верхнем уровне — норм.
		const looseFiles = files.filter((f) => !/^index\.tsx?$/.test(f)).length
		if (looseFiles > 10) {
			add({
				type: "FAT-FOLDER",
				file: dir,
				line: 1,
				symbol: `${looseFiles} файлов`,
				detail: `на верхнем уровне ${looseFiles} свободных файлов (без учёта подпапок) — лимит 10 (v3 no-complex-folder-structure)`,
				moveTo: "разнести по подпапкам-доменам",
			})
		}
	}
}
