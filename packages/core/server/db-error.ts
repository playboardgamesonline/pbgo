/**
 * Whether the database says a column is not there: a project where a migration that adds one is not applied yet (`42703` from Postgres for a read, `PGRST204` from PostgREST for a write). The code that needs such a column degrades
 * instead of failing, until the migration is applied: a read finds nothing, a write leaves the column out.
 */
export const isMissingColumn = (error: { code?: string } | null | undefined): boolean => error?.code === "42703" || error?.code === "PGRST204"

/** Whether the database says a function is not there (`42883` from Postgres, `PGRST202` from PostgREST): a migration that adds one is not applied yet. */
export const isMissingFunction = (error: { code?: string } | null | undefined): boolean => error?.code === "42883" || error?.code === "PGRST202"
