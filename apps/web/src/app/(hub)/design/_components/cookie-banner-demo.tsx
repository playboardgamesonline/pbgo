"use client"

import * as React from "react"
import { BANNER_TEXTS, reserveSpace } from "@pbgo/analytics"
import { Button } from "@pbgo/ui/platform/button"
import { CookieBanner } from "@pbgo/ui/platform/cookie-banner"

/**
 * The banner on a stand-in page. A real page pins it with `fixed` and makes its room on `<body>`; here `absolute` keeps it in its
 * frame and the room is made on the frame, so the button at the bottom of the page rises above the card and drops back when it
 * closes. Any answer closes it (Manage preferences opens the choices one by one first, and Save closes it) and a button brings it
 * back. A first visit shows it at once; a reopened one waits for the click on the "Cookies" link, as on a real page (it takes the
 * focus when it appears, which the page should not do on load).
 */
export function CookieBannerDemo({ reopened = false }: { reopened?: boolean }) {
  const [open, setOpen] = React.useState(!reopened)
  const page = React.useRef<HTMLDivElement>(null)
  const banner = React.useRef<HTMLDivElement>(null)
  const close = () => setOpen(false)

  React.useLayoutEffect(() => (open && page.current && banner.current ? reserveSpace(banner.current, page.current) : undefined), [open])

  return (
    <div ref={page} className="relative flex h-112 flex-col overflow-hidden rounded-2xl border bg-background">
      <div className="p-4">
        <Button variant="outline" size="sm" disabled={open} onClick={() => setOpen(true)}>
          {reopened ? "Cookies" : "Show the banner"}
        </Button>
      </div>
      <div className="mt-auto flex justify-center p-4">
        <Button size="sm">A button at the bottom of the page</Button>
      </div>
      {open && (
        <CookieBanner
          ref={banner}
          className="absolute"
          texts={BANNER_TEXTS.en}
          moreHref="#cookie-banner"
          preferences={reopened ? { analytics: true, recordings: false } : undefined}
          onAccept={close}
          onRefuse={close}
          onSave={close}
          onClose={reopened ? close : undefined}
        />
      )}
    </div>
  )
}
