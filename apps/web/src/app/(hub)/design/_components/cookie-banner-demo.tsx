"use client"

import * as React from "react"
import { BANNER_TEXTS } from "@pbgo/analytics"
import { Button } from "@pbgo/ui/platform/button"
import { CookieBanner } from "@pbgo/ui/platform/cookie-banner"

/**
 * The banner on a stand-in page. On a real page it is `fixed` to the screen; here `absolute` keeps it in its frame. Any answer
 * closes it and a button brings it back. A first visit shows it at once; a reopened one waits for the click on the "Cookies"
 * link, as on a real page (it takes the focus when it appears, which the page should not do on load).
 */
export function CookieBannerDemo({ reopened = false }: { reopened?: boolean }) {
  const [open, setOpen] = React.useState(!reopened)
  const close = () => setOpen(false)
  return (
    <div className="relative h-80 overflow-hidden rounded-2xl border bg-background">
      <div className="p-4">
        <Button variant="outline" size="sm" disabled={open} onClick={() => setOpen(true)}>
          {reopened ? "Cookies" : "Show the banner"}
        </Button>
      </div>
      {open && (
        <CookieBanner
          className="absolute"
          texts={BANNER_TEXTS.en}
          moreHref="#cookie-banner"
          onAccept={close}
          onRefuse={close}
          onClose={reopened ? close : undefined}
        />
      )}
    </div>
  )
}
