import "server-only"
import type { InvitationDeps } from "@pbgo/core/server/invitations"
import { getPlayableGame } from "@pbgo/games"

/** What the invitations to a table need of the app, which core cannot read: the game of a slug when it can be played here (the registry). */
export const invitationDeps: InvitationDeps = { loadGame: getPlayableGame }
