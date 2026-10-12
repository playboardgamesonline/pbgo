import "@fontsource-variable/geist"

/** The `platform` class gives the admin the platform theme (Geist, black and white) instead of the game's own. */
export default function AdminLayout({ children }: LayoutProps<"/[game]/admin">) {
  return <div className="platform flex min-h-dvh flex-col bg-background">{children}</div>
}
