import { eq } from "drizzle-orm"
import type { Column, InferInsertModel, InferSelectModel } from "drizzle-orm"
import type { PgTable } from "drizzle-orm/pg-core"

import { client as db } from "../client"
import { RecordNotFoundError, RecordNotCreatedError } from "./errors-main"

/**
 * Table shape shared by every evals table: an `id` primary key and a
 * `createdAt` timestamp. The generic CRUD helpers below operate on this shape
 * so each table file only declares its table, not the query logic.
 */
type CrudTable = PgTable & {
	id: Column
	createdAt: Column
}

// Drizzle cannot resolve its query-builder row types for a generic table
// parameter, so the table is narrowed to the base `PgTable` at the query entry
// point and the resulting rows are widened back to the table's select model.
// These are single-step `as` casts between comparable types (no `as unknown`).
type Row<TTable extends CrudTable> = InferSelectModel<TTable>

// Insert/update value shapes. Expressed as type aliases so the store methods
// can take them as generic parameters (see `CrudStore` below).
//
// `create` omits the auto-managed `id`/`createdAt` (the store sets them).
// `update` uses `Partial<InferInsertModel>` directly rather than
// `Partial<Omit<...>>`: nesting `Omit` inside `Partial` over drizzle's
// `InferInsertModel` mapped type trips a TypeScript excess-property-check
// bug, whereas the single `Partial` wrapper type-checks fresh object literals
// correctly. Callers never pass `id`/`createdAt` to `update` anyway, and
// drizzle's `.set()` ignores them.
type InsertValues<TTable extends CrudTable> = Omit<InferInsertModel<TTable>, "id" | "createdAt">
type UpdateValues<TTable extends CrudTable> = Partial<InferInsertModel<TTable>>

/**
 * A typed CRUD store for an evals table. Each table gets one store object
 * (see `createCrudStore`), so the find/create/update query logic lives here
 * exactly once instead of being re-implemented per table.
 *
 * `create`/`update` take their values as a generic parameter constrained to
 * the table's insert shape. Passing the object literal as a type argument
 * (rather than directly against the `Omit` mapped type) makes TypeScript
 * check it by assignability instead of excess-property checking, which is the
 * reliable way to type-check fresh literals against a generic `Omit` shape.
 */
export interface CrudStore<TTable extends CrudTable> {
	find: (id: number) => Promise<Row<TTable>>
	create: <TValues extends InsertValues<TTable>>(values: TValues) => Promise<Row<TTable>>
	update: <TValues extends UpdateValues<TTable>>(id: number, values: TValues) => Promise<Row<TTable>>
}

/**
 * Build a `CrudStore` bound to a table. The shared query logic (fetch-by-id,
 * insert-with-createdAt, update-by-id) lives here; table files only supply
 * the table they operate on.
 */
export const createCrudStore = <TTable extends CrudTable>(table: TTable): CrudStore<TTable> => {
	const find = async (id: number) => {
		const rows = (await db
			.select()
			.from(table as PgTable)
			.where(eq(table.id, id))
			.limit(1)) as Row<TTable>[]
		const record = rows[0]

		if (!record) {
			throw new RecordNotFoundError()
		}

		return record
	}

	const create = async (values: Omit<InferInsertModel<TTable>, "id" | "createdAt">) => {
		const rows = (await db
			.insert(table as PgTable)
			.values({ ...values, createdAt: new Date() })
			.returning()) as Row<TTable>[]
		const record = rows[0]

		if (!record) {
			throw new RecordNotCreatedError()
		}

		return record
	}

	const update = async (id: number, values: UpdateValues<TTable>) => {
		const rows = (await db
			.update(table as PgTable)
			.set(values)
			.where(eq(table.id, id))
			.returning()) as Row<TTable>[]
		const record = rows[0]

		if (!record) {
			throw new RecordNotFoundError()
		}

		return record
	}

	return { find, create, update }
}
