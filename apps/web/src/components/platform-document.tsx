/**
 * `<html>` shell of every platform page (hub, legal, 404, `/design`). The `platform` class carries the design system's
 * tokens (`@pbgo/ui/styles/platform.css`) and `bg-background` paints the page. Dark only: no theme provider, no switch.
 * The games have their own root layout (`app/[game]/layout.tsx`) and their own theme.
 */
export function PlatformDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="platform bg-background">
      <body>{children}</body>
    </html>
  )
}
