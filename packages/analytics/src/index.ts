/**
 * The isomorphic part of `@pbgo/analytics`: settings, event types, the consent rules, the URL scrubber, the banner texts and the
 * room the banner keeps free. No PostHog here and nothing that runs on import: the SDKs live behind `./server` and `./client`.
 */
export {
  ANALYTICS_ENABLED,
  CONFIG,
  INGEST_PATH,
  isExcludedPath,
  resolveConfig,
  type AnalyticsConfig,
  type AppEnv,
  type RawEnv,
} from "./config"
export {
  addMonths,
  allowedOf,
  choiceOf,
  CONSENT_KEY,
  CONSENT_RENEWAL_MONTHS,
  clearConsent,
  makeConsent,
  parseConsent,
  readConsent,
  writeConsent,
  type Allowed,
  type Choice,
  type Consent,
  type ConsentStore,
} from "./consent"
export type { ClientEvents, Locale, ServerEvents } from "./events"
export { cookieValue, isLocale, LOCALE_COOKIE, pickLocale } from "./locale"
export { RESERVED_HEIGHT_VAR, reserveSpace } from "./reserve"
export { CODE_PLACEHOLDER, scrubCapture, scrubDeep, scrubText, type Capture } from "./scrub"
export { BANNER_TEXTS, type BannerTexts } from "./texts"
