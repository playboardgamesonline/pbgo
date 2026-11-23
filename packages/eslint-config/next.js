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
  {
    // The hub and the screens around a board load no three.js: `@pbgo/table`, three and react-three-fiber are imported in a game's board folder and nowhere else of it (`pnpm check:game` reads the same rule), so that
    // the board is one lazy chunk and nothing else carries it. The tests of a game may import them wherever they are.
    files: ["games/*/src/**/*.{ts,tsx}", "template/src/**/*.{ts,tsx}"],
    ignores: ["**/src/components/board/**", "**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ["@pbgo/table", "three", "@react-three/fiber", "@react-three/drei"].map((name) => ({
            name,
            message: "Only the board of a game (src/components/board) imports the shared table and three.js, so that the board is one lazy chunk and the hub and the screens around it load none of it.",
          })),
          patterns: [{ group: ["@react-three/*", "three/*"], message: "Only the board of a game (src/components/board) imports three.js, so that the board is one lazy chunk." }],
        },
      ],
    },
  },
  {
    // A board draws on the kit: the `Table` of `@pbgo/table` opens the canvas, with the camera, the lights and the mat, so a board never opens one of its own
    files: ["games/*/src/components/board/**/*.{ts,tsx}", "template/src/components/board/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "@react-three/fiber", importNames: ["Canvas"], message: "A board does not open a canvas of its own: the `Table` of @pbgo/table is the canvas, the camera, the lights and the mat of every game." }] },
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
