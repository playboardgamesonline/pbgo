import { getPartyTable } from "@pbgo/core/routes/api/hub/groups/table/route"

// The table that the leader of the signed-in member's group opened for it (PLT-141): it reads the visitor's session and the database, so never static
export const dynamic = "force-dynamic"

export const GET = getPartyTable
