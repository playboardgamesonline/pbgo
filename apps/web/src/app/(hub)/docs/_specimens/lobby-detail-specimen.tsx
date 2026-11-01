"use client"

import { LobbyDetail, type LobbyDetailProps } from "@pbgo/ui/platform/lobby-panel"

/** A table's details with the button that closes them, which does nothing here: a handler cannot be given by a page of the docs, which is built on the server. */
export function ClosableDetail(props: Omit<LobbyDetailProps, "onClose">) {
  return <LobbyDetail {...props} className="lg:min-h-0" onClose={() => {}} />
}
