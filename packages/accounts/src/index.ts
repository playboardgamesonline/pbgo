// The pure part of the accounts, which the browser, the server and the tests all read (docs/accounts.md). The Supabase clients are `./client` (browser),
// `./server` (Server Components and route handlers) and `./proxy` (the session refresh), kept apart so that none of them reaches the others' bundle. The visitor's language has
// its own small entries, which the games' pages import too: `./language` (the same pure part, alone) and `./set-language` (the setter, with no Supabase in it).

export { AFTER_SIGN_IN, safeNext } from "./redirect"
export { EXTERNAL_EMAIL_DOMAIN, EXTERNAL_PROVIDERS, PROVIDERS, PROVIDER_NAMES, SIGN_IN_PROVIDERS, accountOf, emailOf, initialsOf, isExternalEmail, isExternalProvider } from "./account"
export type { Account, AnyProvider, AuthUser, ExternalProvider, LinkedService, Provider } from "./account"
export { NONCE_MAX_AGE_MS, STATE_PATTERN, STEAM_FALLBACK_NAME, STEAM_LOGIN_URL, STEAM_STATE_COOKIE, STEAM_STATE_MAX_AGE, assertionOf, checkAssertion, fetchSteamProfile, newState, sameSecret, steamConfirms, steamLoginUrl, steamProfileOf, steamReturnTo } from "./steam"
export type { AssertionCheck, AssertionProblem, SteamProfile } from "./steam"
export { externalEmail, externalSignIn } from "./external"
export type { ExternalAdmin, ExternalDeps, ExternalIdentity, ExternalProfile, ExternalSignIn, ExternalStep, ExternalStore } from "./external"
export { DEFAULT_PREFERENCES, NICKNAME_KEY, PREFERENCE_KEYS, nicknameOf, preferencesOf } from "./preferences"
export type { PreferenceName, Preferences } from "./preferences"
export { ACCOUNT_SETTINGS_PATH, SETTINGS_MESSAGES, checkEmailChange, checkNickname, checkPasswordChange, describeDevice, deviceLabel, settingsMessage, settingsProblem } from "./settings"
export type { Device, PasswordProblems, SettingsProblem } from "./settings"
export {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  LANGUAGE_COOKIE_MAX_AGE,
  LANGUAGE_COOKIE_OPTIONS,
  LANGUAGE_KEY,
  PLATFORM_LANGUAGES,
  PLATFORM_LANGUAGE_NAMES,
  hasSessionCookie,
  isPlatformLanguage,
  languageCookie,
  languageFromCookies,
  languageOf,
  matchPlatformLanguage,
  planLanguage,
  resolveLanguage,
} from "./language"
export type { LanguagePlan, LanguageSources, PlatformLanguage } from "./language"
export { CODE_LENGTH, DISPLAY_NAME_MAX, PASSWORD_MIN, RESEND_SECONDS, checkSignup, secondsLeft } from "./signup"
export type { ResendOutcome, SignupEntry, SignupFields, SignupOutcome, SignupProblems } from "./signup"
export { confirmEmail, confirmFailedPath, confirmNext, confirmRequestOf } from "./confirm"
export { mostPlayed, ordinal, perGame, playedGameOf, statsFrom, statsOf } from "./games"
export type { FinishedGame, GameStats, GameTotals, PlayedGame } from "./games"
export { supabaseAuthConfig } from "./config"
export type { AuthEnv, SupabaseAuthConfig } from "./config"
