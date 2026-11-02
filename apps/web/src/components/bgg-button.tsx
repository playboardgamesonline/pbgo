"use client"

import { useState, useSyncExternalStore } from "react"
import { Button } from "@pbgo/ui/platform/button"

// BoardGameGeek, as a small button under the credits of a game's page: its icon, which opens the game's page there in a new tab. The icon is a plain `<img>` of an address of this site's own (the hub's catalog route finds it on
// BoardGameGeek's website, so that a visitor's browser never asks BoardGameGeek for anything), the way a publisher's is in the credits (`CreditLink`), and it is only asked for once the page is interactive, so that an `error` is always heard:
// one that fired before would leave an empty square that nothing fills. An icon that cannot be had leaves "BGG" in its place, so that the link is never blank. The icon says nothing to a screen reader: the link is named "BoardGameGeek".

const subscribe = () => () => {}

export function BggButton({ href, icon }: { href: string; icon: string }) {
  const interactive = useSyncExternalStore(subscribe, () => true, () => false)
  const [broken, setBroken] = useState(false)
  return (
    <Button variant="outline" size={broken ? "default" : "icon"} asChild>
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label="BoardGameGeek" title="BoardGameGeek">
        {broken
          ? "BGG"
          : interactive && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={icon} alt="" width={20} height={20} decoding="async" className="block size-5 object-contain" onError={() => setBroken(true)} />
            )}
      </a>
    </Button>
  )
}
