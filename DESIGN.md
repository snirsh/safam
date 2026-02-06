# Safam Design Guidelines

Design language inspired by Claude Code's terminal aesthetic, translated for a mobile-first web app.

## Core Philosophy

- **Warm minimalism**: Not cold/clinical. Inviting, like an evening conversation.
- **Information-dense**: Every pixel earns its place. No decorative filler.
- **Scannable**: Key info readable in < 1 second. Clear visual hierarchy.
- **Terminal-inspired, web-native**: Monospace accents, clean lines, but fully interactive.

## Color Palette

### Light Mode
| Role | Value | Usage |
|------|-------|-------|
| Background | `#FAFAF9` (warm off-white) | Page background |
| Surface | `#FFFFFF` | Cards, panels |
| Border | `#E7E5E4` | Subtle dividers |
| Text Primary | `#1C1917` | Headings, key data |
| Text Secondary | `#78716C` | Labels, descriptions |
| Accent | `#C15F3C` (terracotta) | Primary actions, active states |
| Accent Hover | `#AE5630` | Hover states |
| Success | `#16A34A` | Income, positive balance |
| Danger | `#DC2626` | Expenses, negative balance, errors |
| Warning | `#CA8A04` | Caution states |
| Muted | `#F5F5F4` | Backgrounds for code, tags |

### Dark Mode (Default)
| Role | Value | Usage |
|------|-------|-------|
| Background | `#0C0A09` | Page background |
| Surface | `#1C1917` | Cards, panels |
| Surface Elevated | `#292524` | Popovers, dropdowns |
| Border | `#292524` | Dividers |
| Text Primary | `#FAFAF9` | Headings, key data |
| Text Secondary | `#A8A29E` | Labels, descriptions |
| Accent | `#C15F3C` (terracotta) | Primary actions |
| Success | `#4ADE80` | Income, positive |
| Danger | `#F87171` | Expenses, negative |

### Threshold Colors (for metrics/progress)
- Default/Good: success green
- Warning (>50%): warning yellow
- Critical (>80%): danger red

## Typography

### Font Stack
- **Headings & UI**: `Geist Sans` (the Vercel font already in the project)
- **Numbers, amounts, code**: `Geist Mono`
- **Body text**: `Geist Sans` at regular weight

### Scale
| Element | Size | Weight | Font |
|---------|------|--------|------|
| Page title | `text-xl` (20px) | Bold | Mono |
| Section header | `text-sm` (14px) | Medium | Sans |
| Body | `text-sm` (14px) | Regular | Sans |
| Label | `text-xs` (12px) | Regular | Sans |
| Amount (large) | `text-2xl` (24px) | Bold | Mono |
| Amount (table) | `text-sm` (14px) | Regular | Mono |
| Badge/tag | `text-xs` (12px) | Regular | Sans |

### Rules
- Page titles use `font-mono` for the terminal feel
- All monetary amounts use `font-mono`
- Labels/descriptions use `text-muted-foreground`
- Uppercase sparingly — only for card labels (e.g., "INCOME", "EXPENSES")
- Use `tracking-wider` on uppercase labels

## Layout

### Structure
```
┌─────────────────────────────────────────┐
│ Sidebar (desktop)  │  Main Content      │
│                    │                    │
│ safam              │  Page Title        │
│ ─────              │                    │
│ ~ Dashboard        │  ┌─────┬─────┐    │
│ $ Transactions     │  │Card │Card │    │
│ # Categories       │  └─────┴─────┘    │
│ > Accounts         │                    │
│ @ Recurring        │  ┌─────────────┐   │
│ % Forecast         │  │ Data Table  │   │
│                    │  │             │   │
│                    │  └─────────────┘   │
└─────────────────────────────────────────┘
```

### Mobile
```
┌─────────────────────┐
│ safam               │
├─────────────────────┤
│ Tab nav (scrollable) │
├─────────────────────┤
│                     │
│  Main Content       │
│  (full width)       │
│                     │
│  Cards stacked      │
│  vertically         │
│                     │
└─────────────────────┘
```

### Spacing
- Page padding: `p-4` mobile, `p-6` desktop
- Card padding: `p-4`
- Between sections: `space-y-6`
- Between cards in grid: `gap-4`
- Max content width: `max-w-4xl` centered

### Sidebar
- Width: `w-56` (224px)
- Nav items: monospace prefix icon + label
- Active state: `bg-accent text-foreground`
- Collapsed on mobile: horizontal tab bar instead

## Components

### Cards
```
┌────────────────────────┐
│ INCOME                 │  ← uppercase label, text-xs, text-muted-foreground
│ ₪12,500               │  ← font-mono, text-2xl, font-bold, text-green-500
└────────────────────────┘
```
- Border: `border border-border`
- Background: `bg-card`
- Rounded: `rounded-lg`
- No shadows (flat, terminal feel)

### Tables / Lists
- Use `divide-y divide-border` for row separation
- No zebra striping
- Hover: `hover:bg-accent/50`
- Table header: `text-xs text-muted-foreground uppercase tracking-wider`
- On mobile: switch to card layout

### Badges / Tags
- Small: `rounded-md bg-accent px-2 py-0.5 text-xs`
- Category badges: colored dot + name
- Status badges: success/warning/danger colors

### Empty States
- Centered text in a bordered container
- Short, actionable message
- `text-sm text-muted-foreground`

### Buttons
- Primary: terracotta accent, `bg-accent text-white`
- Secondary: `bg-secondary text-secondary-foreground`
- Ghost: `hover:bg-accent/10`
- All: `rounded-md` (not fully rounded)

### Charts (Recharts)
- Use CSS variable colors for theme compatibility
- Minimal grid lines (light, dashed)
- No heavy borders on chart areas
- Tooltip: dark bg with light text
- Area fills: use low opacity (0.1-0.2)

## Patterns

### Amount Display
- Income: `text-green-500` with `+` prefix
- Expense: `text-red-500` with `-` prefix
- Always use `font-mono`
- Format: `₪12,500` (ILS symbol, no decimals for display)

### Status Indicators
- Synced: green dot
- Error: red dot
- Pending: yellow dot
- Size: `h-2 w-2 rounded-full`

### Loading States
- Use skeleton loaders (`bg-muted animate-pulse rounded`)
- Match the shape of the content being loaded
- No spinners (too distracting)

### Navigation
- Active link: `bg-accent text-foreground`
- Inactive: `text-muted-foreground hover:text-foreground`
- Monospace prefix characters for terminal feel (`~`, `$`, `#`, `>`, `@`, `%`)

## Do / Don't

### Do
- Use monospace for all financial data
- Keep cards flat (no shadows)
- Use the terracotta accent sparingly for key actions
- Prefer dark mode as default
- Use semantic color (green=income, red=expense) consistently
- Keep information density high
- Use small text sizes — this is a power-user tool

### Don't
- Don't use gradients
- Don't use large rounded corners (max `rounded-lg`)
- Don't use decorative icons everywhere
- Don't use shadows for elevation (use border instead)
- Don't center-align data — left-align, right-align amounts
- Don't use purple/blue AI gradients (avoid generic "AI app" look)
- Don't pad excessively — tight, dense layouts
