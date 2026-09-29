"use client"

import { Analytics01Icon, LinkSquare02Icon, Logout03Icon, Settings02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@pgo/ui/admin/button"
import { adminRequest } from "../../lib/admin-api"
import { cn } from "@pgo/ui/utils"

const NAV = [
  { href: "/setup", label: "Setup", icon: Settings02Icon },
  { href: "/status", label: "Status", icon: Analytics01Icon },
]

export function AdminShell({ title, logo, children }: { title: string; logo: string | null; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await adminRequest("/api/admin/logout", { method: "POST" }).catch(() => null)
    router.refresh()
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="h-7 w-auto max-w-24 object-contain" />
            ) : (
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-xs text-primary-foreground">{title.slice(0, 1)}</span>
            )}
            <span className="truncate">{title}</span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((n) => (
              <Button key={n.href} asChild variant="ghost" size="sm" className={cn(pathname === n.href && "bg-muted")}>
                <Link href={n.href}>
                  <HugeiconsIcon icon={n.icon} strokeWidth={2} data-icon="inline-start" />
                  {n.label}
                </Link>
              </Button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link href="/" target="_blank">
                <HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} data-icon="inline-start" />
                <span className="hidden sm:inline">Voir le site</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={logout}>
              <HugeiconsIcon icon={Logout03Icon} strokeWidth={2} data-icon="inline-start" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  )
}
