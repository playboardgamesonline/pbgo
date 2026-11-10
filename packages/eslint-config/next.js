import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

/**
 * ESLint flat config of the whole repo: the root `eslint.config.mjs` re-exports it and `pnpm lint` runs ESLint once from the root over
 * every package that holds code (the hub, the shared packages, the games, the template and the platform), so a new package is linted
 * with no line of its own. The patterns are `**` led: the config is read from the root, and a build folder is one of a package.
 */
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The repo has no Pages Router: this rule looks for a `pages` folder, finds none and only says so, once for each run.
      "@next/next/no-html-link-for-pages": "off",
      // A name that starts with an underscore is unused on purpose: the parameter of a stand-in that keeps the signature it stands for, the field that a rest leaves out.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
    },
  },
  globalIgnores([
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/dist/**",
    "**/.sanity/**",
    "**/coverage/**",
    "**/next-env.d.ts",
    // Written by `sanity typegen`.
    "**/src/sanity/types.ts",
  ]),
])
