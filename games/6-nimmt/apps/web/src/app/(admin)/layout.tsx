import "@fontsource-variable/inter"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin flex min-h-dvh flex-col">{children}</div>
}
