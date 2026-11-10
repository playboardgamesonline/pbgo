// The pure part of the accounts, which the browser, the server and the tests all read (docs/accounts.md). The Supabase clients are `./client` (browser),
// `./server` (Server Components and route handlers) and `./proxy` (the session refresh), kept apart so that none of them reaches the others' bundle. The visitor's language has
// its own small entries, which the games' pages import too: `./language` (the same pure part, alone) and `./set-language` (the setter, with no Supabase in it).

export { AFTER_SIGN_IN, safeNext } from "./redirect"
export { OLDEST_AGE, RESTRICTED_FROM, SITE_MINIMUM_AGE, ageInYears, ageOn, ageRefusal, birthdateProblem, isRealDay, restrictedAge, utcDayOf } from "./age"
export type { AgeRefusal, AgeSubject, BirthdateProblem, CalendarDate } from "./age"
export {
  CONNECTION_PROVIDERS,
  EXTERNAL_EMAIL_DOMAIN,
  EXTERNAL_PROVIDERS,
  PROVIDERS,
  PROVIDER_NAMES,
  SIGN_IN_PROVIDERS,
  accountOf,
  canUnlink,
  emailOf,
  initialsOf,
  isConnection,
  isExternalEmail,
  isExternalProvider,
  linkedServicesOf,
  waysIn,
} from "./account"
export type { Account, AnyProvider, AuthUser, ExternalProvider, LinkedService, Provider } from "./account"
export { NONCE_MAX_AGE_MS, STATE_PATTERN, STEAM_FALLBACK_NAME, STEAM_LOGIN_URL, STEAM_STATE_COOKIE, STEAM_STATE_MAX_AGE, assertionOf, checkAssertion, fetchSteamProfile, newState, sameSecret, steamConfirms, steamLoginUrl, steamProfileOf, steamReturnTo } from "./steam"
export type { AssertionCheck, AssertionProblem, SteamProfile } from "./steam"
export { externalEmail, externalLink, externalSignIn, externalUnlink } from "./external"
export type { ExternalAdmin, ExternalDeps, ExternalIdentity, ExternalLink, ExternalProfile, ExternalSignIn, ExternalStep, ExternalStore, ExternalUnlink } from "./external"
export { DEFAULT_PREFERENCES, NICKNAME_KEY, PREFERENCE_KEYS, REDUCE_CHOICES, TIME_FORMATS, hourCycleOf, isReduceChoice, isTimeFormat, nicknameOf, preferencesOf } from "./preferences"
export type { PreferenceName, Preferences, ReduceChoice, SwitchPreferenceName, TimeFormat } from "./preferences"
export {
  COUNTRY_CODES,
  COUNTRY_KEY,
  birthYearOf,
  birthdateFields,
  birthdateOfParts,
  calendarDateOf,
  checkBirthdate,
  checkCountry,
  countryName,
  countryOf,
  countryOptions,
  isCountryCode,
} from "./details"
export type { BirthdateField, BirthdateFields } from "./details"
export {
  ACCOUNT_SETTINGS_PATH,
  SETTINGS_MESSAGES,
  checkEmailChange,
  checkNickname,
  checkPasswordChange,
  describeDevice,
  deviceLabel,
  linkNoticeOf,
  nicknameCharactersLeft,
  settingsMessage,
  settingsProblem,
  unlinkProblem,
} from "./settings"
export type { Device, LinkNotice, PasswordProblems, SettingsProblem } from "./settings"
export {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  LANGUAGE_COOKIE_MAX_AGE,
  LANGUAGE_COOKIE_OPTIONS,
  LANGUAGE_KEY,
  PLATFORM_LANGUAGES,
  PLATFORM_LANGUAGE_NAMES,
  PLATFORM_LANGUAGE_REGIONS,
  SPOKEN_LANGUAGES,
  baseLanguageOf,
  hasSessionCookie,
  isPlatformLanguage,
  languageCookie,
  languageFromCookies,
  languageOf,
  matchPlatformLanguage,
  planLanguage,
  resolveLanguage,
} from "./language"
export type { LanguagePlan, LanguageRegion, LanguageSources, PlatformLanguage } from "./language"
export { MFA_MESSAGES, TOTP_FACTOR_NAME, TOTP_LENGTH, aalOf, formatSetupKey, isTotpCode, mfaMessage, mfaProblem, qrImageOf, secondStepDevicesOf, secondStepPending, secondStepPendingOf, sinceLabel } from "./mfa"
export type { Assurance, AuthFactor, MfaProblem, SecondStepDevice } from "./mfa"
export { CODE_LENGTH, DISPLAY_NAME_MAX, PASSWORD_MIN, RESEND_SECONDS, checkSignup, secondsLeft } from "./signup"
export type { ResendOutcome, SignupEntry, SignupFields, SignupOutcome, SignupProblems } from "./signup"
export { confirmEmail, confirmEmailSession, confirmFailedPath, confirmNext, confirmRequestOf } from "./confirm"
export { DELETION_MESSAGES, REOPEN_PATH, deletionDate, deletionMessage, hasMailbox, isReopenToken, isUserId, maskEmail, reopenLink, reopenLinkOf } from "./deletion"
export type { DeletionAnswer, DeletionRequest } from "./deletion"
export { mostPlayed, ordinal, perGame, playedGameOf, statsFrom, statsOf } from "./games"
export type { FinishedGame, GameStats, GameTotals, PlayedGame } from "./games"
export { supabaseAuthConfig } from "./config"
export type { AuthEnv, SupabaseAuthConfig } from "./config"
