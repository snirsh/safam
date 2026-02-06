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
