"use client"

import { useState, useSyncExternalStore } from "react"
import { Button } from "@pbgo/ui/platform/button"

// BoardGameGeek, as a small button under the credits of a game's page: its icon and "Powered by BGG", which open the game's page there in a new tab. The words are BoardGameGeek's condition for the figures it gives the catalog (the complexity,
// the players, the duration and the age: PLT-78, `docs/platform-sanity.md`): the credit is shown and links back. BoardGameGeek's own logo can take their place the day the owner hands it over. The icon is a plain `<img>` of an address of this site's own (the hub's catalog route finds it on
// BoardGameGeek's website, so that a visitor's browser never asks BoardGameGeek for anything), the way a publisher's is in the credits (`CreditLink`), and it is only asked for once the page is interactive, so that an `error` is always heard:
// one that fired before would leave an empty square that nothing fills. An icon that cannot be had leaves the words alone, so that the link is never blank. The icon says nothing to a screen reader: the link is named by its words.

const subscribe = () => () => {}

export function BggButton({ href, icon }: { href: string; icon: string }) {
  const interactive = useSyncExternalStore(subscribe, () => true, () => false)
  const [broken, setBroken] = useState(false)
  return (
    <Button variant="ghost" size="sm" className="text-muted-foreground/60 hover:text-foreground" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer" title="BoardGameGeek">
        {!broken && interactive && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon} alt="" width={16} height={16} decoding="async" data-icon="inline-start" className="block size-4 object-contain opacity-60 transition-opacity duration-fast group-hover/button:opacity-100" onError={() => setBroken(true)} />
        )}
        Powered by BGG
      </a>
    </Button>
  )
}
