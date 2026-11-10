"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useRef, type ReactNode } from "react"
import { initialsOf, tagText } from "@pbgo/accounts"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { Dialog, DialogContent, DialogTitle } from "@pbgo/ui/platform/dialog"
import { SettingsNav } from "@/components/settings-nav"

/**
 * The settings of a signed-in member as a window, the way the apps the owner pointed to have them: the sidebar at the left (the member's name, which leads to their profile, the sections and Sign out), the section at its right, a close button at its
 * top right, and the page behind it dimmed. The window is the same wherever it comes from. `over` says whether it opens over the page the member was on (a link from the account menu, intercepted by `@modal`: the page stays under it and closing goes
 * back to it) or is the page itself (the address was typed, a link of an e-mail opened it, the page was reloaded: there is nothing under it, and closing leads to the front page, which sends a member to their home). The sections are the pages
 * under `/me/settings`, so a link can lead straight to one. It keeps the room of the consent banner free (`--consent-h`: `docs/design/01-guidelines/04-in-game-rules.md`), as every screen of the hub does: shorter by the banner's height and lifted by half of it. A slot keeps what it showed when the page changes under it, so the window draws nothing once the address is no longer the settings' (a link of the sidebar to the profile, for one).
 */
export function SettingsModal({ nickname, tag, avatarUrl, over, children }: { nickname: string; /** The member's tag, which the head of the window says after their name; null where it is not known. */ tag?: number | null; avatarUrl: string | null; over: boolean; children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const content = useRef<HTMLDivElement>(null)

  function onOpenChange(open: boolean) {
    if (open) return
    if (over) router.back()
    else router.push("/")
  }

  if (!pathname.startsWith("/me/settings")) return null

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        ref={content}
        aria-describedby={undefined}
        // The first button of the window is Sign out, at the foot of the sidebar, which is where the focus would go: it goes to the window itself, and the first press of Tab to the first link
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          content.current?.focus()
        }}
        showCloseButton
        className="flex flex-col gap-0 overflow-hidden bg-background p-0 md:flex-row max-sm:top-0 max-sm:left-0 max-sm:h-[calc(100svh-var(--consent-h,0px))] max-sm:w-screen max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none sm:top-[calc((100svh-var(--consent-h,0px))/2)] sm:h-[min(52rem,calc(100svh-4rem-var(--consent-h,0px)))] sm:w-[min(68rem,calc(100vw-4rem))] sm:max-w-none sm:rounded-4xl"
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <aside className="flex min-h-0 shrink-0 flex-col gap-3 border-b bg-card/50 p-3 md:w-72 md:gap-4 md:border-r md:border-b-0 md:p-5">
          <Link href="/me" className="flex min-w-0 items-center gap-3 rounded-xl p-2 outline-none max-md:mr-12 transition-colors duration-fast hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30">
            <Avatar size="lg">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="" referrerPolicy="no-referrer" />}
              <AvatarFallback>{initialsOf(nickname)}</AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-col">
              <span className="ph-mask flex min-w-0 items-baseline text-sm text-foreground">
                <span className="truncate">{nickname}</span>
                {tag != null && <span className="shrink-0 text-muted-foreground">#{tagText(tag)}</span>}
              </span>
              <span className="text-xs text-muted-foreground">View profile</span>
            </span>
          </Link>
          <SettingsNav className="md:flex-1" />
        </aside>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="max-w-2xl p-6 md:p-10">{children}</div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
