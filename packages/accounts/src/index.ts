// The pure part of the accounts, which the browser, the server and the tests all read (docs/accounts.md). The Supabase clients are `./client` (browser),
// `./server` (Server Components and route handlers) and `./proxy` (the session refresh), kept apart so that none of them reaches the others' bundle. The visitor's language has
// its own small entries, which the games' pages import too: `./language` (the same pure part, alone) and `./set-language` (the setter, with no Supabase in it).

export { AFTER_SIGN_IN, safeNext } from "./redirect"
export { PROVIDERS, PROVIDER_NAMES, accountOf, emailOf, initialsOf } from "./account"
export type { Account, AuthUser, LinkedService, Provider } from "./account"
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
export { ordinal, perGame, statsOf } from "./games"
export type { PlayedGame } from "./games"
export { supabaseAuthConfig } from "./config"
export type { AuthEnv, SupabaseAuthConfig } from "./config"
