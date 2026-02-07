# Safam — Lessons Learned

_Updated as we go. Each lesson prevents repeating the same mistake._

## Phase 1

1. **Lazy DB connection**: Never initialize Neon/Drizzle at module scope — Next.js evaluates route modules during build when DATABASE_URL doesn't exist. Use a lazy proxy.
2. **Self-referential FK**: Drizzle's `.references()` on a self-referential column (categories.parentId -> categories.id) causes circular type inference. Omit the `.references()` call and rely on Drizzle relations + migration SQL.
3. **exactOptionalPropertyTypes strictness**: shadcn/ui generated code may not be compatible with `exactOptionalPropertyTypes: true`. Expect to patch theme-related props (e.g., `useTheme()` returning `string | undefined`).
4. **create-next-app is interactive**: Even with CLI flags, Next.js 16 create-next-app prompts for linter and React Compiler. Faster to scaffold package.json + tsconfig.json manually.
5. **pnpm onlyBuiltDependencies**: Set in `package.json` under `"pnpm"` key, not via interactive `pnpm approve-builds`.
6. **Dual Drizzle drivers cause union types**: When `createDrizzleInstance()` returns either `NeonHttpDatabase` or `PostgresJsDatabase`, the union makes `.insert()` uncallable. Fix: use one canonical type (`NeonHttpDatabase`) and cast the other.
7. **ESM + require() is incompatible**: With `"type": "module"` in package.json, `require()` is undefined. Use static `import` at top level and let bundlers tree-shake, or use `await import()`.
8. **drizzle-kit doesn't load .env.local**: Use `dotenv` with explicit `{ path: ".env.local" }` in `drizzle.config.ts`.
9. **tsx doesn't load .env.local**: Same fix — add `import { config } from "dotenv"` at the top of seed scripts.

## Phase 2

10. **exactOptionalPropertyTypes + WebAuthn DOM types**: The browser's `PublicKeyCredentialCreationOptions` and `PublicKeyCredentialRequestOptions` types don't allow `undefined` for optional fields like `excludeCredentials`, `allowCredentials`, `timeout`, `attestation`. When building these objects from server JSON (where optional fields may be `undefined`), construct objects with only required fields first, then conditionally add optional properties with `if (value !== undefined)` guards.
11. **@simplewebauthn/types is deprecated**: In SimpleWebAuthn v13+, types are bundled with `@simplewebauthn/server`. Import types directly from `@simplewebauthn/server`.
12. **Oxlint no-console in API routes**: API route error logging with `console.error` is legitimate. Add an override in `.oxlintrc.json` for `src/app/api/**/*.ts` to disable `no-console`.
13. **Next.js 16 middleware deprecation**: `middleware.ts` still works but shows a warning about migrating to `proxy`. The functionality is the same for now.

## Phase 3

14. **Readonly tuple `includes()` strictness**: `INSTITUTIONS[key].credentials` is `readonly ["username", "password"]`. Calling `.includes(k)` where `k` is `string` fails TS2345. Fix: annotate as `readonly string[]` to widen the type before calling `.includes()`.

## Phase 4

15. **israeli-bank-scrapers `ScraperCredentials` type**: The library's `scrape()` expects a union type (`ScraperCredentials`), not `Record<string, string>`. Since credentials come dynamically from the DB, cast with `as ScraperCredentials`.
16. **pnpm workspace + root scripts**: Adding `pnpm-workspace.yaml` doesn't break `pnpm run build` etc. from root — they still work. `pnpm build` shorthand also works. The `-w` flag is only needed with `pnpm add`.
