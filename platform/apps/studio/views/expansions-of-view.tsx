import { Box, Card, Flex, Spinner, Stack, Text } from "@sanity/ui"
import { useEffect, useState } from "react"
import { getPublishedId, useClient } from "sanity"
import { IntentLink } from "sanity/router"
import type { UserViewComponent } from "sanity/structure"
import { EXPANSIONS_OF_QUERY, type ExpansionOf } from "./expansions-of"

type Settled = { status: "failed"; message: string } | { status: "ready"; expansions: ExpansionOf[] }

/**
 * The "Expansions" tab of a game: the expansions that name it as their base game, read from the expansions themselves (the link is
 * stored on the expansion only). Read-only: an expansion is added in Expansions, with this game as its base game.
 */
export const ExpansionsOf: UserViewComponent = ({ documentId }) => {
  const client = useClient({ apiVersion: "2025-02-19" })
  const id = getPublishedId(documentId)
  // What the last read found, with the client and the game it was made for: until the read of this game is back the tab is loading, and a read made for another game is forgotten
  const [read, setRead] = useState<{ client: typeof client; id: string; settled: Settled } | null>(null)
  const current = read !== null && read.client === client && read.id === id
  const state = current ? read.settled : ({ status: "loading" } as const)
  if (read && !current) setRead(null)

  useEffect(() => {
    let live = true
    client
      .fetch<ExpansionOf[]>(EXPANSIONS_OF_QUERY, { id }, { perspective: "drafts" })
      .then((expansions) => live && setRead({ client, id, settled: { status: "ready", expansions } }))
      .catch(
        (error: unknown) =>
          live && setRead({ client, id, settled: { status: "failed", message: error instanceof Error ? error.message : "The expansions could not be read" } }),
      )
    return () => {
      live = false
    }
  }, [client, id])

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
      {state.status === "ready" && state.expansions.length === 0 && (
        <Card padding={4} radius={2} tone="transparent" border>
          <Text size={1} muted>
            No expansion has this game as its base game yet. Add one in Expansions, in the Catalog.
          </Text>
        </Card>
      )}
      {state.status === "ready" && state.expansions.length > 0 && (
        <Stack gap={2}>
          {state.expansions.map((expansion) => (
            <Card key={expansion._id} as={IntentLink} intent="edit" params={{ id: getPublishedId(expansion._id), type: "expansion" }} padding={3} radius={2} border>
              <Text size={1} weight="medium">
                {expansion.name ?? "Untitled expansion"}
              </Text>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  )
}
