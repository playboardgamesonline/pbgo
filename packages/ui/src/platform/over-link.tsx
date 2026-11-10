"use client"

import * as React from "react"

// A row that is a link has its link stretched over the whole row (`TableEntry` with `to`: the link's `::after` covers the row). What the pointer must find above it, a player's picture, whose card opens under the pointer, and the free seat's own button or link, is raised over
// the link (`relative z-10`), and a press that lands on it does not reach the link. This is what is raised: a press on it that is not on a link or a button of its own goes on where the link leads, as a click that the link receives (with the keys that were held, so that a press
// with the command key still opens a new tab), so that the whole row leads wherever it is pressed, a picture included. What the picture opens, a card in a portal, is no part of the row: only a press on what is in the element goes on.

/** Whatever sits over the stretched link of a row (`data-slot="table-entry"`, whose link is `data-slot="table-entry-link"`) and still leads where the link leads. */
function OverLink({ onClick, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="over-link"
      {...props}
      onClick={(event) => {
        onClick?.(event)
        const target = event.target as Element
        if (event.defaultPrevented || !event.currentTarget.contains(target) || target.closest("a, button")) return
        const link = event.currentTarget.closest("[data-slot=table-entry]")?.querySelector<HTMLAnchorElement>("a[data-slot=table-entry-link]")
        link?.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true, view: window, ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey, altKey: event.altKey })
        )
      }}
    />
  )
}

export { OverLink }
