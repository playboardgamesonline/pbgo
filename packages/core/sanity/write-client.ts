import "server-only"
import { createClient } from "next-sanity"
import { sanityConfigure } from "./client"
import { apiVersion, dataset, projectId } from "./env"

const token = process.env.SANITY_API_WRITE_TOKEN

export const sanityWritable = sanityConfigure && !!token

export const writeClient = sanityWritable ? createClient({ projectId, dataset, apiVersion, token, useCdn: false }) : null
