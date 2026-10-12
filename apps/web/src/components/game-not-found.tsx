"use client"

import dynamic from "next/dynamic"
import { PageNotFound } from "@pbgo/core/components/home/page-not-found"
import { useHasBinding } from "@pbgo/core/lib/binding-context"

const SiteNotFoundPage = dynamic(() => import("@/components/site-not-found-page"))

/**
 * 404 under `/<slug>/...`. The layout mounts a game's runtime for a slug of the registry only: with it, the game's own 404 (its
 * look and language); without it, the site's.
 */
export function GameNotFound() {
  return useHasBinding() ? <PageNotFound /> : <SiteNotFoundPage />
}
