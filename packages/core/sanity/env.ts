import * as binding from "@pbgo/binding"

/** Projet Sanity : variable d'environnement, sinon `SANITY_PROJECT_ID` du jeu (lib/site.ts, rempli par go-live). */
export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? (binding as { SANITY_PROJECT_ID?: string }).SANITY_PROJECT_ID ?? "__SANITY_PROJECT_ID__"
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production"
export const apiVersion = "2026-09-27"
