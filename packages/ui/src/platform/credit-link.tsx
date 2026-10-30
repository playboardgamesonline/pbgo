"use client"

import * as React from "react"
import { cn } from "../utils"

// A name of the credits of a game that leads somewhere else, a publisher's: the name with the icon of its website at the left of it, the two being one link that opens in a new tab. The icon is
// a plain `<img>` of an address of this site's own (the hub's catalog route finds it on the publisher's website, so that a visitor's browser never asks that website for anything) and it is decorative
// (`alt=""`): the name is what the link says. Its place, 16px, is kept from the first paint, so that the name does not move when the icon comes in. A site that has no icon, or an icon that cannot be
// had, leaves the name alone: the place is given up when the browser says the picture failed. The icon sits on the baseline of the name (so the link stands on the line of the text around it, which
// a centred icon would lift) and is lowered a little, to the middle of the letters. The server cannot know whether there is an icon, and an `error` that fires before the page is interactive
// would not be heard (a hole in front of the name that nothing fills), so the picture is only asked for once it is.

const subscribe = () => () => {}

type CreditLinkProps = Omit<React.ComponentProps<"a">, "href" | "target" | "rel"> & {
  /** The address of the website, which the link opens in a new tab. */
  href: string
  /** The address of its icon, on this site. Without it, or when it cannot be had, the name stands alone. */
  icon?: string
}

/** A name that is a link to a website, with that website's icon before it. */
function CreditLink({ href, icon, className, children, ...props }: CreditLinkProps) {
  const interactive = React.useSyncExternalStore(subscribe, () => true, () => false)
  const [broken, setBroken] = React.useState(false)
  return (
    <a
      data-slot="credit-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex items-baseline gap-2 text-foreground underline underline-offset-4", className)}
      {...props}
    >
      {icon && !broken && (
        <span aria-hidden="true" className="relative top-0.5 size-4 shrink-0">
          {interactive && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={icon} alt="" width={16} height={16} decoding="async" className="block size-4 rounded-sm object-contain" onError={() => setBroken(true)} />
          )}
        </span>
      )}
      {children}
    </a>
  )
}

export { CreditLink, type CreditLinkProps }
