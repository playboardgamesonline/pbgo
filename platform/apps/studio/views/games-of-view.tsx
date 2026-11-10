import { Badge, Box, Card, Flex, Spinner, Stack, Text } from "@sanity/ui"
import { useEffect, useState } from "react"
import { getPublishedId, useClient } from "sanity"
import { IntentLink } from "sanity/router"
import type { UserViewComponent } from "sanity/structure"
import { gamesOfQuery, rolesLine, type GameOf, type Holder } from "./games-of"

type Options = { of: Holder }

type Settled = { status: "failed"; message: string } | { status: "ready"; games: GameOf[] }

/**
 * The "Games" tab of a creator or a publisher: the games that list them, read from the games themselves (the link is stored on the
 * game only), with what a creator did on each. Read-only: a person is added to a game on the game.
 */
export const GamesOf: UserViewComponent<Options> = ({ documentId, options }) => {
  const client = useClient({ apiVersion: "2025-02-19" })
  const id = getPublishedId(documentId)
  // What the last read found, with the client, the person and the kind of holder it was made for: until the read of this one is back the tab is loading, and a read made for another one is forgotten
  const [read, setRead] = useState<{ client: typeof client; id: string; of: Holder; settled: Settled } | null>(null)
  const current = read !== null && read.client === client && read.id === id && read.of === options.of
  const state = current ? read.settled : ({ status: "loading" } as const)
  if (read && !current) setRead(null)

  useEffect(() => {
    let live = true
    client
      .fetch<GameOf[]>(gamesOfQuery(options.of), { id }, { perspective: "drafts" })
      .then((games) => live && setRead({ client, id, of: options.of, settled: { status: "ready", games } }))
      .catch(
        (error: unknown) =>
          live && setRead({ client, id, of: options.of, settled: { status: "failed", message: error instanceof Error ? error.message : "The games could not be read" } }),
      )
    return () => {
      live = false
    }
  }, [client, id, options.of])

  return (
    <Box padding={4}>
      {state.status === "loading" && (
        <Flex justify="center" padding={5}>
          <Spinner />
        </Flex>
      )}
      {state.status === "failed" && (
        <Card padding={4} radius={2} tone="critical" border>
          <Text size={1}>{state.message}</Text>
        </Card>
      )}
      {state.status === "ready" && state.games.length === 0 && (
        <Card padding={4} radius={2} tone="transparent" border>
          <Text size={1} muted>
            No game lists this {options.of} yet. Add them on a game, in its Credits tab.
          </Text>
        </Card>
      )}
      {state.status === "ready" && state.games.length > 0 && (
        <Stack gap={2}>
          {state.games.map((game) => (
            <Card key={game._id} as={IntentLink} intent="edit" params={{ id: getPublishedId(game._id), type: "game" }} padding={3} radius={2} border>
              <Flex align="center" gap={3} justify="space-between">
                <Text size={1} weight="medium">
                  {game.name ?? "Untitled game"}
                </Text>
                {game.roles && game.roles.length > 0 && <Badge tone="primary">{rolesLine(game.roles)}</Badge>}
              </Flex>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  )
}
