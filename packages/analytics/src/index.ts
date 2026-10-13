/**
 * The isomorphic part of `@pbgo/analytics`: settings, event types, the consent rules, the URL scrubber and the banner texts.
 * No PostHog here and nothing that needs a server or a browser: the SDKs live behind `./server` and `./client`.
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
  CONSENT_KEY,
  CONSENT_RENEWAL_MONTHS,
  clearConsent,
  makeConsent,
  parseConsent,
  readConsent,
  writeConsent,
  type Choice,
  type Consent,
  type ConsentStore,
} from "./consent"
export type { ClientEvents, Locale, ServerEvents } from "./events"
export { cookieValue, isLocale, LOCALE_COOKIE, pickLocale } from "./locale"
export { CODE_PLACEHOLDER, scrubCapture, scrubDeep, scrubText, type Capture } from "./scrub"
export { BANNER_TEXTS, type BannerTexts } from "./texts"
