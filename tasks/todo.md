# Safam — Implementation Progress

## Phase 1: Project Bootstrap & Infrastructure
- [x] Initialize Next.js 16.1 with pnpm
- [x] Configure strict TypeScript (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, noUnusedLocals, noUnusedParameters)
- [x] Install Drizzle ORM + Neon driver + postgres.js (dual-driver)
- [x] Configure Oxlint and Oxfmt
- [x] Init shadcn/ui (New York, Zinc, CSS vars, button/card/input/label/sonner)
- [x] Create full DB schema (10 tables, enums, relations, indexes)
- [x] Create seed script (16 parent + 59 subcategories + 2 dev users + full demo data)
- [x] Create health-check API route
- [x] Create .env.local.example, .gitignore, .npmrc
- [x] Init git repo, verify typecheck + build pass

## Phase 1.5: Local Dev Flow & Design System
- [x] Docker Compose for local Postgres
- [x] Dual-driver DB (postgres.js local, Neon production)
- [x] Dev-mode auth bypass (auto-login as seeded user)
- [x] Dashboard layout (sidebar + mobile tab nav)
- [x] Dashboard page with summary cards + recent transactions
- [x] Categories page (renders seeded data)
- [x] Placeholder pages for all routes
- [x] DESIGN.md — Claude Code-style UI/UX guidelines
- [x] Full local flow verified: docker up -> db:push -> db:seed -> dev -> browse

## Phase 1.75: Demo Data & Theme
- [x] Expand categories (16 parents: +Children & Family, +Personal Care, +Financial, +Gifts & Donations; 59 subcategories: +Arnona, +Car Insurance, +Tolls, +Coffee & Cafes, +Dental, +Vision, +Haircuts, +Bank Fees, etc.)
- [x] Demo financial accounts (Leumi, Isracard, One Zero)
- [x] Demo transactions (132 across 4 months with realistic Hebrew descriptions)
- [x] Demo recurring patterns (11 detected), categorization rules (19), sync logs (2)
- [x] Transactions page — full table (desktop) + card list (mobile) with category badges
- [x] Accounts page — cards with sync status and green/red dots
- [x] Recurring page — list with confidence badges, frequency tags, monthly total
- [x] Dashboard — real account/recurring counts, category badges on recent transactions
- [x] Dark/light mode toggle (system default, cycles system→light→dark)

## Phase 2: Authentication (Passkeys)
- [x] Install @simplewebauthn/server + jose
- [x] WebAuthn server helpers (src/lib/auth/webauthn.ts) — registration + authentication flows
- [x] JWT session management (src/lib/auth/session.ts) — create/verify/destroy with jose, 30-day HttpOnly cookies
- [x] 5 API routes: register options/verify, login options/verify, logout
- [x] Next.js middleware (src/middleware.ts) — protects dashboard, allows auth/health/webhook
- [x] Auth layout + login page + register page (passkey-based, no passwords)
- [x] Household logic: first user creates, second joins, third rejected (max 2)
- [x] Dev mode bypass preserved (auto-login as first seeded user)
- [x] Verified: typecheck + build + lint + dev mode all pass

## Phase 3: Account Management & Webhook
- [x] AES-256-GCM encryption module (src/lib/crypto/encryption.ts) — encrypt/decrypt with iv:authTag:ciphertext format
- [x] Webhook auth module (src/lib/webhook/auth.ts) — Bearer token validation with timing-safe comparison
- [x] Institution config (src/lib/constants/institutions.ts) — 7 Israeli banks/cards with credential schemas
- [x] Account management API: GET /api/accounts + POST /api/accounts (encrypted credentials)
- [x] Account update API: PATCH /api/accounts/[id] (name, credentials, isActive toggle)
- [x] Webhook endpoint: POST /api/webhook/transactions (idempotent insert, encrypted payloads, sync logging)
- [x] shadcn dialog + select components installed
- [x] Add Account dialog with dynamic credential fields per institution
- [x] Account toggle (activate/deactivate) client component
- [x] Accounts page updated: add button, toggle, shared institution config
- [x] Verified: typecheck + build + lint all pass

## Phase 4: Bank Scraper (GitHub Actions)
- [x] GET /api/webhook/accounts endpoint — returns active accounts with encrypted creds (Bearer auth)
- [x] pnpm workspace setup (pnpm-workspace.yaml) — root app + scraper package
- [x] Scraper package: package.json, tsconfig.json, 6 src files
- [x] Institution → CompanyTypes mapping (scraper/src/config.ts)
- [x] Standalone AES-256-GCM decrypt (scraper/src/crypto.ts)
- [x] API client: fetchAccounts() + pushTransactions() (scraper/src/api-client.ts)
- [x] Transaction transform: library format → webhook format with stable externalId (scraper/src/transform.ts)
- [x] Single account scraper wrapper (scraper/src/scrape-account.ts)
- [x] Main orchestrator with per-account error isolation (scraper/src/index.ts)
- [x] GitHub Actions workflow: cron 08:00/20:00 IST + manual dispatch (.github/workflows/scrape-banks.yml)
- [x] Verified: app typecheck + build + lint pass, scraper typecheck passes

## Phase 5: Transactions & Categories UI
- [ ] Not started

## Phase 6: AI Auto-Categorization
- [ ] Not started

## Phase 7: Recurring Detection & Forecasting
- [ ] Not started

## Phase 8: Dashboard & Polish
- [ ] Not started
