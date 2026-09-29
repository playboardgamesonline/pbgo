import { createClient } from "next-sanity"
import { apiVersion, dataset, projectId } from "./env"

export const sanityConfigure = /^[a-z0-9-]+$/.test(projectId)

export const client = sanityConfigure ? createClient({ projectId, dataset, apiVersion, useCdn: true }) : null
