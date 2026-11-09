import { DISPLAY_SCRIPT } from "@pbgo/accounts/display"

/**
 * `<html>` shell of every platform page (hub, legal, 404, `/docs`). The `platform` class carries the design system's
 * tokens (`@pbgo/ui/styles/platform.css`) and `bg-background` paints the page. Dark only: no theme provider, no switch.
 * The head carries one small script that copies the member's choices for how the site is shown (the cookies of their device: its motion and its transparency) onto `<html>` before the first paint,
 * where the stylesheet and `useReducedMotion` read them: it asks the device and never the server, so the static pages stay static. `<html>` says
 * `suppressHydrationWarning` because that attribute is there before React looks at it. The games have their own root layout (`app/[game]/layout.tsx`) and their own theme.
 */
export function PlatformDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="platform bg-background" suppressHydrationWarning>
      {/* The head of a root layout is the layout's own in the App Router, which `next/head` is not for */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: DISPLAY_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
