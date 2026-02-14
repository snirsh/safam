# Safam Demo Showcase — Implementation Plan

## Summary
Build a fully interactive, public demo of Safam deployed on a separate Vercel instance. Features a bilingual landing page, auto-login (no passkey needed), realistic Israeli family data (12+ months), animated bank scraping simulation, and all app features explorable.

---

## Phase 0: Fix billing_day Bug
> **Goal**: Unblock the forecast page locally and in production

- [ ] Run `drizzle-kit push` to sync schema (adds `billing_day` column to `financial_accounts`)
- [ ] Verify locally: forecast page loads without error
- [ ] If production DB also missing the column, run `ALTER TABLE financial_accounts ADD COLUMN billing_day integer;` against production

---

## Phase 1: Demo Mode Infrastructure
> **Goal**: Environment-based toggle that bypasses auth and enables demo features

### 1.1 Environment Variable
- [ ] Add `NEXT_PUBLIC_DEMO_MODE` env var
- [ ] When `true`: skip passkey auth, show landing page at `/`, show demo banner in app

### 1.2 Auth Bypass
- [ ] Modify `src/lib/auth/session.ts`: in demo mode, `getSession()` returns a hardcoded demo user session (similar to existing dev mode but works in production builds)
- [ ] Modify `src/app/(dashboard)/layout.tsx`: skip redirect-to-login when demo mode
- [ ] Modify `src/app/(auth)/layout.tsx`: in demo mode, redirect straight to dashboard (no login page needed)

### 1.3 Demo Banner
- [ ] Create `src/components/demo-banner.tsx` — small dismissable banner at top of dashboard layout
- [ ] Text: "You're viewing a demo. Data resets periodically." (bilingual)
- [ ] Sticky, minimal, doesn't interfere with app usage
- [ ] Only rendered when `NEXT_PUBLIC_DEMO_MODE === "true"`

### 1.4 Root Page Conditional
- [ ] Modify `src/app/page.tsx`: if demo mode → render landing page component, else → redirect to `/dashboard` (current behavior)

### 1.5 Disable Real Scraping
- [ ] In demo mode, the "Sync" button on accounts page triggers the scraping simulation instead of real scraping
- [ ] Block `/api/accounts/[id]/sync` and `/api/cron/scrape` in demo mode (return mock success)

---

## Phase 2: Bilingual Landing Page
> **Goal**: A polished, responsive marketing page that showcases Safam's value proposition

### 2.1 Landing Page Component
- [ ] Create `src/app/(landing)/page.tsx` or inline in `src/app/page.tsx` (demo mode only)
- [ ] Responsive, dark-mode compatible, uses existing Tailwind + shadcn design tokens

### 2.2 Language Toggle
- [ ] Simple `he`/`en` state toggle (React state, no i18n library needed — just the landing page)
- [ ] Store preference in localStorage
- [ ] Toggle button in landing page header (e.g., "עב / EN")
- [ ] When Hebrew: RTL layout (`dir="rtl"`) on the landing page container

### 2.3 Landing Page Sections

**Header/Nav Bar**
- App logo + name "Safam" / "ספם"
- Language toggle
- Theme toggle (dark/light)
- "Try the Demo" CTA button

**Hero Section**
- Headline: "Your family budget, on autopilot" / "התקציב המשפחתי שלכם, באוטומט"
- Subheadline: "Connect your Israeli bank accounts, categorize with AI, forecast your future" / Hebrew equivalent
- Primary CTA: "Explore the Demo" → `/dashboard`
- Hero image/illustration: screenshot of the dashboard or an abstract finance illustration

**Feature Cards (4 cards in a grid)**
1. **Auto Bank Sync** — "Connects to Israeli banks (Leumi, Isracard, ONE Zero...) and pulls transactions automatically"
   - Icon: refresh/sync icon
   - Mini screenshot of accounts page
2. **AI Categorization** — "Gemini AI automatically categorizes your transactions into meaningful categories"
   - Icon: sparkles/brain
   - Mini screenshot of transactions with category badges
3. **Recurring Detection** — "Automatically detects recurring payments: salary, rent, subscriptions, utilities"
   - Icon: repeat/calendar
   - Mini screenshot of recurring page
4. **Cash Flow Forecast** — "Know your end-of-month balance before it happens. Never be surprised."
   - Icon: chart/trending
   - Mini screenshot of forecast page

**Security Section**
- "Passwordless login with passkeys (Face ID, Touch ID)"
- "Bank credentials encrypted at rest"
- "Your data stays yours — self-hosted option available"

**Footer**
- "Built with Next.js, Vercel, Neon Postgres"
- GitHub link (optional)

### 2.4 Animations
- [ ] Use Framer Motion (already installed) for scroll-triggered animations
- [ ] Feature cards fade/slide in on scroll
- [ ] Hero text entrance animation

---

## Phase 3: Rich Demo Seed Data
> **Goal**: 12+ months of realistic Israeli family budget data that makes every feature shine

### 3.1 Enhanced Seed Script
- [ ] Create `scripts/seed-demo.ts` (separate from existing `seed.ts` to keep them independent)
- [ ] Can be run standalone: `pnpm tsx scripts/seed-demo.ts`

### 3.2 Demo Family Profile: "משפחת כהן" (The Cohen Family)
**Accounts (4):**
1. **Bank Leumi — Checking** (bank, "4521") — primary account, salary deposits
2. **Bank Hapoalim — Joint** (bank, "7890") — secondary, spouse's salary
3. **Isracard** (credit_card, "8734", billingDay: 2) — main credit card
4. **Max (Leumi Card)** (credit_card, "3456", billingDay: 10) — secondary CC

**Monthly Income (~42,000 ILS):**
- Tech salary (Leumi): 25,000 on 1st
- Spouse part-time (Hapoalim): 12,000 on 5th
- Child allowance (Leumi): 500 on 20th (ביטוח לאומי)
- Occasional freelance: 2,000-5,000 sporadically

**Monthly Recurring Expenses:**
- Mortgage (Leumi): 6,800 on 3rd
- Arnona/municipal tax (Leumi): 850 on 15th
- Electricity (Isracard): 350-650 (seasonal)
- Water (Leumi): 180 on 10th
- Gas (Leumi): 250 on 12th
- Internet — Bezeq (Isracard): 170 on 8th
- Cellphone — Partner (Isracard): 120 on 7th
- Netflix (Max): 55 on 15th
- Spotify (Max): 30 on 1st
- Gym — Holmes Place (Isracard): 350 on 5th
- Kids after-school (Leumi): 1,800 on 1st
- Car insurance (Leumi): 450 on 20th (bi-monthly)
- Health insurance supplement (Leumi): 280 on 1st

**Variable Expenses (spread across both CCs):**
- Groceries: Shufersal (שופרסל), Rami Levy (רמי לוי), Yochananof (יוחננוף) — 3,000-5,000/month
- Fuel: Paz (פז), Sonol (סונול), Delek (דלק) — 600-900/month
- Restaurants: Orna & Ella, Café Café, Aroma (ארומה), Shipudei HaTikva — 800-1,500/month
- Kids activities: Gymboree, swimming lessons — 200-600/month
- Shopping: Fox, Zara, IKEA, ACE — occasional 200-2,000
- Medical: Clalit (כללית), Maccabi (מכבי), pharmacy — occasional 50-500
- Online: Amazon, AliExpress, iHerb — occasional 100-800

**One-off Notable Transactions:**
- Dental work: 3,500 (3 months ago)
- Weekend getaway (Dead Sea): 2,200 (2 months ago)
- New washing machine (Mahsanei Hashmal): 3,800 (5 months ago)
- Kids' birthday party: 1,500 (4 months ago)
- Car repair (test/טסט): 2,100 (6 months ago)

### 3.3 Data Characteristics
- [ ] 12 months of history (350-500 transactions)
- [ ] Mix of classification methods: ~60% rule-based, ~25% AI, ~10% manual, ~5% uncategorized
- [ ] Seasonal variation: higher electricity in summer, heating in winter, holiday spending in Sept/Apr
- [ ] A few transfers between accounts (Leumi → Hapoalim)
- [ ] Realistic recurring patterns with some variation (±5-15% on amounts)
- [ ] Some "missed" recurring months (to show <100% confidence)
- [ ] Next expected dates set correctly for forecast to work
- [ ] Starting balances: Leumi 45,000, Hapoalim 18,000, CCs at 0

### 3.4 Sync Logs
- [ ] Generate 12 months of weekly sync logs for each account
- [ ] Mix of successful syncs + 1-2 failed ones (to show error handling)

---

## Phase 4: Scraping Simulation
> **Goal**: Animated fake scraping flow that shows the value of auto-sync

### 4.1 Simulation Dialog Component
- [ ] Create `src/components/demo/scraping-simulation.tsx`
- [ ] Triggered by "Sync" button in demo mode (instead of real scraping)

### 4.2 Simulation Flow (5-8 seconds total)
1. **"Connecting to Bank Leumi..."** (1.5s) — spinning loader + bank logo
2. **"Authenticating..."** (1s) — lock icon animation
3. **"Fetching transactions..."** (2s) — progress bar 0-100%
4. **"Processing 47 transactions..."** (1s) — counting animation
5. **"Categorizing with AI..."** (1s) — sparkle animation
6. **"Done! 47 new, 3 duplicates skipped"** — success checkmark
- [ ] Use Framer Motion for smooth transitions between steps
- [ ] Show realistic Israeli bank logos (Leumi, Hapoalim, Isracard icons)
- [ ] After completion, refresh the transactions list (or just close dialog)

### 4.3 Bank Logo Assets
- [ ] Add simple SVG/icon representations for Israeli banks
- [ ] Leumi (blue), Hapoalim (red), Isracard (orange), ONE Zero (green), Max (purple)

---

## Phase 5: Polish & UX Enhancements
> **Goal**: Make the demo feel premium and self-explanatory

### 5.1 Guided First Impression
- [ ] On first dashboard load in demo mode, show a brief welcome toast: "Welcome to Safam! Explore the demo with 12 months of sample data."
- [ ] Optionally: subtle pulse animation on sidebar nav items to encourage exploration

### 5.2 Feature Tooltips (Optional)
- [ ] Add small info badges on key features explaining what they do
- [ ] Example: next to "AI" classification badge → "This transaction was automatically categorized by Gemini AI"

### 5.3 Empty State Prevention
- [ ] Ensure every page has meaningful data to show
- [ ] Forecast should show a mix of "on track" and "needs attention" indicators
- [ ] Recurring page should have patterns across all confidence levels

### 5.4 Screenshot-Ready Styling
- [ ] Verify all pages look good in both light and dark mode
- [ ] Check mobile responsiveness on all pages
- [ ] Ensure chart colors are vibrant and readable

---

## Phase 6: Deployment
> **Goal**: Live demo accessible via Vercel URL

### 6.1 Vercel Project Setup
- [ ] Create a new Vercel project (or deploy to a branch preview)
- [ ] Link same GitHub repo
- [ ] Set env vars: `NEXT_PUBLIC_DEMO_MODE=true`, `JWT_SECRET`, `DATABASE_URL` (demo Neon branch)
- [ ] No `ENCRYPTION_KEY` needed (no real credentials)
- [ ] No Gemini API key needed (categorization is pre-seeded)

### 6.2 Neon DB Branch
- [ ] Create a Neon branch for demo data
- [ ] Run schema push: `drizzle-kit push`
- [ ] Run demo seed: `DATABASE_URL=<demo-branch-url> pnpm tsx scripts/seed-demo.ts`

### 6.3 Automated Reset (Optional)
- [ ] Vercel cron job that re-seeds demo data daily/weekly
- [ ] Prevents demo data from getting corrupted by random users clicking around
- [ ] Endpoint: `POST /api/cron/reset-demo` (protected by cron secret)

### 6.4 Verification
- [ ] Visit demo URL — landing page loads
- [ ] Click "Try Demo" — dashboard loads with data
- [ ] Navigate all 6 pages — all functional
- [ ] Try dark/light mode toggle
- [ ] Try mobile viewport
- [ ] Trigger scraping simulation
- [ ] Test bilingual landing page toggle

---

## File Change Summary

### New Files
| File | Purpose |
|------|---------|
| `src/components/demo/scraping-simulation.tsx` | Animated scraping mock |
| `src/components/demo-banner.tsx` | "This is a demo" banner |
| `src/app/(landing)/page.tsx` | Bilingual landing page (or inline in `src/app/page.tsx`) |
| `scripts/seed-demo.ts` | Rich 12-month demo seed data |
| `public/banks/` | Israeli bank logo SVGs/icons |

### Modified Files
| File | Change |
|------|--------|
| `src/app/page.tsx` | Demo mode → landing page, else → redirect |
| `src/lib/auth/session.ts` | Demo mode auto-session |
| `src/app/(dashboard)/layout.tsx` | Demo banner + auth bypass |
| `src/app/(auth)/layout.tsx` | Demo mode redirect |
| `src/components/accounts/sync-button.tsx` | Demo mode → simulation |
| `src/app/api/cron/scrape/route.ts` | Block in demo mode |
| `src/app/api/accounts/[id]/sync/route.ts` | Block in demo mode |

---

## Order of Execution
1. **Phase 0** — Fix billing_day bug (15 min)
2. **Phase 1** — Demo mode infra (1 session)
3. **Phase 3** — Seed data (1 session) — do before landing page so we can see real data while designing
4. **Phase 2** — Landing page (1-2 sessions)
5. **Phase 4** — Scraping simulation (1 session)
6. **Phase 5** — Polish (1 session)
7. **Phase 6** — Deploy (1 session)

---

## Resolved Questions
1. OG meta tags / social preview — **No**, skip for now
2. Domain — **Vercel preview URL** is fine
3. Landing page visuals — **Live embedded previews** of actual app components (not screenshots)
4. Hebrew copy/branding — **No special preferences**, keep it simple
