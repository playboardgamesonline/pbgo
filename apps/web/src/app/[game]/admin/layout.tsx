import "@fontsource-variable/inter"

export default function AdminLayout({ children }: LayoutProps<"/[game]/admin">) {
  return <div className="admin flex min-h-dvh flex-col">{children}</div>
}
