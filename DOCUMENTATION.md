# nms-tam — Documentation

The **web application**: a multi-client (multi-tenant) network monitoring service. Clients add their own devices
and see real health, metrics, interface traffic, incidents and alerts. You sell it in plans with a device quota and
record payments by hand. All measurement work belongs to the engine (`../nms-monitoring`); this app owns people,
ownership, money and the UI.

```
Browser ──► this Next.js app ──► monitoring engine (private, API key)
             Clerk login              polls devices with ICMP / TCP / SNMP
             plans, quota, payments   owns all monitoring data
             ownership of every object
```

Companion documents in this repo: [`README.md`](README.md) (product summary and setup),
[`CLAUDE.md`](CLAUDE.md) (working rules for agents), [`.env.example`](.env.example).

---

## 1. Tooling

| Concern | Choice |
|---|---|
| Framework | **Next.js 16** (App Router, server components, server actions), **React 19** |
| Language | **TypeScript 5**, path alias `@/*` → repo root |
| Database | **PostgreSQL** via **Prisma 7** with `@prisma/adapter-pg`. Client generated into `generated/prisma` — import from `@/generated/prisma` |
| Auth | **Clerk** (`@clerk/nextjs` 7, `@clerk/backend` 3). Middleware in `proxy.ts` |
| Validation | **Zod 4** (`servers/validators/*`), **react-hook-form** + `@hookform/resolvers` on the client |
| Styling | **Tailwind CSS 4** (`@tailwindcss/postcss`), `tw-animate-css`, `prettier-plugin-tailwindcss` |
| Components | **shadcn/ui** in `components/ui/` (55 primitives) over **Radix UI** / **Base UI**; icons from **lucide-react** and **HugeIcons** |
| Data fetching (client) | **@tanstack/react-query** 5; tables with **@tanstack/react-table** 8 |
| Charts & maps | **Recharts** 3; **Leaflet** + **react-leaflet** for the device map |
| Misc UI | `sonner` (toasts), `cmdk` (global search), `vaul`, `embla-carousel`, `react-day-picker`, `input-otp`, `next-themes`, `react-resizable-panels` |
| Dates / formatting | **date-fns** 4, `slugify`, `clsx` + `tailwind-merge` |
| Tests | **Vitest 3** (node environment) over `servers/**` and `lib/**` |
| Lint / format | **ESLint 9** (`eslint-config-next`), **Prettier 3** |

> `AGENTS.md` warns that this Next.js version has breaking changes versus older conventions — read
> `node_modules/next/dist/docs/` before writing framework-level code. Note that the Clerk middleware lives in
> **`proxy.ts`**, not `middleware.ts`.

### Scripts

```bash
npm run dev            # next dev
npm run build          # next build
npm start              # next start
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm test               # vitest run  (servers/**, lib/**)
npm run worker         # tsx worker/index.ts  — the background job, keep it running
npm run create-admin   # -- you@company.com "Your Name"   (first admin, prints a one-time password)
npm run smoke          # end-to-end check against the real DB + a running engine
npm run demo:alerts    # dev only: sample incidents/rules/channels for designing the alert pages (-- --remove undoes it)
npm run seed           # prisma/seed.ts
npm run seed:export    # scripts/export-seed.ts
npx prisma migrate dev | deploy | generate
```

## 2. Installation

### Requirements

* Node.js (matching Next 16), PostgreSQL — the **same database as the engine**: this app uses schema `public`,
  the engine uses `nms_monitoring`
* A running engine (`cd ../nms-monitoring && npm run build && npm start`)
* A Clerk application

### Step 1 — Clerk dashboard

These can only be set in the Clerk dashboard, not from code:

| Setting | Value |
|---|---|
| User & authentication → Email address | Required, **verify at sign-up** (email code) |
| User & authentication → Password | On |
| User & authentication → Username / phone | Off (sign-in is by email) |
| Multi-factor authentication | Optional. Off is fine — sign-in is email + password, and Clerk asks for an email code on a new device |
| Restrictions → Sign-up mode | **Restricted** (invitation only) |

Sign-up is invitation-only: an admin invites a person, Clerk emails a link, and the link opens `/sign-up`. The
invitation itself proves the email address, so no code is asked there. To force two-step verification for staff,
enable it in Clerk and set `REQUIRE_ADMIN_MFA=true`; admins then see a setup screen until it is on.

### Step 2 — Environment (`.env`, from `.env.example`)

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Same database as the engine |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | From the Clerk dashboard |
| `ENGINE_URL` | Default `http://127.0.0.1:8088` |
| `ENGINE_API_KEY` | One of the engine's `ENGINE_API_KEYS`. **Server-side only** |
| `APP_URL` | Public URL of this app; used in invitation links |
| `ALLOW_PRIVATE_TARGETS` | **Must be `false` in production.** `true` only in dev, to monitor loopback/private addresses |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-in`, `/sign-up` — use our own auth pages |
| `SUPPORT_URL` | Optional: the "Customer support" button target (mailto / WhatsApp / help-desk). Hidden when empty |
| `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_ATTRIBUTION` | Optional base map. Defaults to public OpenStreetMap tiles |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Optional: enables AI analysis in the incident detail sheet |
| `REQUIRE_ADMIN_MFA` | Optional: force authenticator setup for admins |
| `WORKER_INTERVAL_SEC` | Optional: worker tick, default 300 |

`lib/config.ts` reads these and also defines runaway-usage caps that are *not* part of any plan:
500 alert rules, 20 channels and 100 credentials per org, and 36 months per payment.

### Step 3 — Run

```bash
npm install
npx prisma migrate deploy
npx prisma generate
npm run create-admin -- you@company.com "Your Name"   # once: the first admin cannot invite themselves
npm run dev                                           # or: npm run build && npm start
npm run worker                                        # second terminal, keep it running
```

Then sign in and: create a plan (**Plans**) → create a client (**Clients**) → record its first payment (this
activates the plan) → invite its users (**Users**).

No Docker: the app, the worker and the engine run as three Node processes under any process manager
(pm2 — see `../ecosystem.config.js` — NSSM, or systemd).

## 3. Layers and code layout

Every write follows the same path, and the layers do not skip each other:

```
app/action/           "use server": guard → validator → service → revalidatePath
                      returns run(...) → { ok, data } | { ok: false, error }
servers/validators/   zod schemas (+ the input types inferred from them)
servers/services/     the ONLY place that touches Prisma (lib/prisma) or the engine
servers/engine/       engine-client.ts (typed fetch), engine-call.ts (error translation + name prefixing)
servers/billing/      pure pricing rules (unit tested)
servers/monitoring/   target-policy.ts — which hosts a client may point us at
lib/auth.ts           getCurrentUser · require* (pages, redirect) · assert* (actions, throw)
```

| Path | Contents |
|---|---|
| `app/(auth)/` | `sign-in` (email + password + email/authenticator/backup code), `sign-up` (invitation), `forgot-password`, `not-invited` |
| `app/(dashboard)/` | The layout (navbar, rail, notifications, subscription banner, MFA gate) and every dashboard page |
| `app/action/` | 12 server-action modules: `device`, `device-group`, `alert`, `channel`, `credential`, `incident`, `billing`, `plan`, `organization`, `user`, `engine`, `simulate` |
| `components/dashboard/` | 34 shared pieces (tables, charts, pickers, headers) plus one folder per feature: `admin`, `alerts`, `billing`, `channels`, `credentials`, `dashboard`, `devices`, `incidents`, `map`, `profile`, `users` |
| `components/ui/` | shadcn primitives — **add with the CLI, do not edit by hand** |
| `components/auth/` | `AuthShell`, `MfaSetup`, `SignOutButton`, and the sign-in / sign-up forms |
| `lib/` | `auth`, `config`, `prisma`, `action` (the `run()` wrapper), `errors`, `format`, `date-range`, `sidebar-menu`, `ttl-memo`, and the pure helpers `availability`, `incident-stats`, `alert-text`, `traffic-history`, `port-family` |
| `worker/index.ts` | The single background job |
| `scripts/` | `create-admin`, `smoke`, `demo-alerts`, `export-seed` |
| `prisma/` | `schema.prisma`, four migrations, `seed.ts` |
| `providers/` | `Providers` (React Query, Clerk, toasts), `ThemeProvider` |
| `proxy.ts` | Clerk middleware: everything except the public auth paths needs a signed-in user |

### The guard helpers (`lib/auth.ts`)

| Helper | Use | On failure |
|---|---|---|
| `getCurrentUser()` | Read the signed-in user's own record (React `cache`d) | returns `null` |
| `requireUser()` / `requireAdmin()` / `requireClient()` | **Pages** | redirect |
| `assertUser()` / `assertAdmin()` / `assertClient()` | **Server actions** | throw |

`requireClient()` / `assertClient()` return `{ user, orgId }` — and that `orgId` always comes from the user's own
database record.

### The action contract

```ts
// app/action/*.ts
"use server";
export async function createDevice(input: CreateDeviceInput) {
  return run(async () => {
    const { orgId } = await assertClient();       // 1. guard
    const parsed = CreateDeviceSchema.parse(input); // 2. validate
    const device = await DeviceMonitorService.create(orgId, parsed); // 3. service
    revalidatePath("/dashboard/devices");          // 4. revalidate
    return device;
  });
}
```

`run()` (`lib/action.ts`) exists because Next hides a thrown error's message in production, but the user needs to
read "Device quota reached" or "Host not allowed". It maps `AppError` → `{ ok: false, error: message }`,
`ZodError` → the first issue's message, and anything else → `"Something went wrong"` (logged server-side).

## 4. Tenancy: the rules that keep clients apart

These are load-bearing. Do not weaken them.

1. **Every server action starts with `assertClient()` or `assertAdmin()`.** A `"use server"` export is a public
   HTTP endpoint.
2. **The organization comes from the signed-in user's record**, never from an argument or the request.
3. **Ownership goes through the mirror tables** (`Device`, `EngineResource`): look the object up by
   `{ id, orgId }` first, *then* translate to the engine id. A miss is a **404**, never a "forbidden" that would
   confirm the object exists.
4. **Never create an engine rule without a device** — it would apply to every client — and never call an engine
   list endpoint without an `ids` list built from this client's own mirror rows. ("All my devices" creates one
   rule per device.)
5. Engine credential and channel names go through `engineName(orgId, label)` → `o<orgId>:<label>`, because the
   engine requires globally unique names. `stripEngineName()` removes the prefix before a client sees it, and
   `engine-call.ts` also strips it out of error messages.
6. Anything that changes state calls `requireLive(orgId)` (subscription active). **Deleting is allowed when
   expired.**
7. Amounts are whole Rupiah (`Int`). A plan that has subscribers is immutable (`PlanService.update`).
8. Server components must not pass functions to client components — pass a plain value (e.g. a unit name).
9. The engine API key stays server-side; `lib/config.ts` is server-only.

Two more protections worth naming:

* **Host policy** (`servers/monitoring/target-policy.ts`). Before a test or save, the target host is checked:
  loopback, private, link-local, CGNAT, multicast and reserved ranges are refused, IPv4 and IPv6, **including
  hostnames that resolve to one**. Clients therefore cannot make the platform probe your own network.
  `ALLOW_PRIVATE_TARGETS=true` lifts this for development only.
* **Slot reservation.** `DeviceService.reserve()` takes `SELECT … FOR UPDATE` on the organization row inside a
  transaction, so two simultaneous "add device" requests cannot both take the last slot. A reservation that never
  completes is a `PENDING` device row, swept later by the worker (`purgeStalePending`).

## 5. Data model (`prisma/schema.prisma`, schema `public`)

| Model | Purpose |
|---|---|
| `Organization` | A client company. Status `ACTIVE` / `SUSPENDED` |
| `User` | `clerkId` (null until the invited person signs up), email, role `USER` \| `ADMIN`, `orgId` (null for staff) |
| `Plan` | Name, `priceMonthly`, `extraSlotPrice`, `maxDevices`, `maxUsers`, `minPollIntervalSec`, `isActive`, `sortOrder` |
| `Subscription` | One per org: plan + `status` + `currentPeriodEnd` + `extraSlots` |
| `Payment` | One recorded payment and its receipt. Plan name/price and slot price are **copied in**, so later plan edits never change an old receipt |
| `ReceiptSequence` | Per-year receipt counter (`RCP-2026-0001`) |
| `BillingRequest` | A client asking for more slots / another plan / renewal; `OPEN` → `DONE` \| `REJECTED` |
| `Device` | **Ownership mirror** of an engine device: `engineDeviceId`, name, `status` (`PENDING`/`ACTIVE`/`SUSPENDED`), `disabledBy` (`SUBSCRIPTION`/`USER`), plus app-only `latitude`/`longitude` and `groupId` |
| `DeviceGroup` | A client-defined bucket of devices ("Area A"). App-side only — the engine never sees it |
| `EngineResource` | Ownership mirror of engine credentials / channels / alert rules (`kind`, `engineId`, `label`) |
| `AuditLog` | Actor, org, action, target, metadata |
| `IncidentAnalysis` | The last AI analysis of an engine incident, kept so reopening costs no new request |

Everything *measured* lives in the engine's schema. `Device.latitude`, `longitude` and `groupId` are deliberately
app-only, as is `DeviceGroup`.

## 6. The engine client

`servers/engine/engine-client.ts` exposes one typed `engine` object — devices, fleet, metrics, interfaces,
credentials, channels, rules, incidents and the admin simulate endpoints — with per-call timeouts (45 s for a
device test, 60 s for a manual poll, 5 s for health). A list call given an **empty** `ids` array short-circuits to
an empty result instead of asking the engine, so "this client owns nothing" can never become "return everything".

`servers/engine/engine-call.ts` wraps a call and translates engine failures into messages that are safe to show a
client:

| Engine status | Becomes |
|---|---|
| 404 | `AppError("Not found", 404)` |
| 409 | the engine's message, with the `o<orgId>:` prefix stripped |
| 400 | the message plus flattened validation details, prefix stripped |
| 429 | "The monitoring service is busy. Try again in a few seconds." |
| anything else | logged server-side; the client sees "The monitoring service is unavailable right now." (503) |

## 7. Services

All Prisma and engine access is here. `servers/services/`:

| Service | Responsibility |
|---|---|
| `device-monitor.service` | The big one: `test`, `create`, `update`, `remove`, `setEnabled`, `pollNow`, `testStored`, `syncOrgDevices`, `fleet`, `detail`, `metrics`, `interfaces`, `interfaceTraffic`, `latencyHistory`, `trafficHistory`, `deviceExtras`, `setInterfaceMonitored` |
| `device.service` | The ownership mirror: `listByOrg`, `getOwned`, `getByEngineId`, `count`, `reserve`/`confirm`/`release`, `setCoordinates`, `setName`, `setGroup`, `setStatus`, `purgeStalePending` |
| `device-group.service` | Groups: `listByOrg`, `create`, `rename`, `remove`, `assertOwned` |
| `alert-config.service` | Credentials, channels and alert rules — list/create/rotate/update/enable/test/delete |
| `incident.service` | `list`, `get`, `acknowledge` (always scoped to the client's device ids) |
| `incident-ai.service` | Gemini analysis of an incident against a strict Zod/response schema; a stored answer in an older shape is treated as missing so the sheet offers to re-analyze |
| `subscription.service` | `getEntitlements` — **the single source of truth for "what may this client do right now"** — plus `usage`, `changePlan`, `setExtraSlots`, `cancel`, `markExpired` |
| `payment.service` | `record` (applies activation / renewal / extra slots / adjustment and issues the receipt), `void`, `list`, `getById` |
| `plan.service` | Plan CRUD; a plan with subscribers is immutable |
| `organization.service`, `user.service`, `clerk.service` | Clients, their users, and the Clerk side (`invite`, `ban`, `unban`) |
| `billing-request.service` | Client requests: `list`, `countOpen`, `create`, `resolve` |
| `resource.service` | The `EngineResource` mirror, including `getOwnedByEngineId` and `removeByEngineIds` |
| `engine-admin.service` | Admin tools: engine `health`, and `orphans` — objects that exist in the engine but that no client owns (left behind by a crash or created by hand) |
| `simulate.service` | Admin-only historical-data simulation, driven through the engine's `/admin/simulate` |
| `audit.service` | `log`, `list` |

`lib/ttl-memo.ts` gives read-only, slowly-changing queries a tiny in-process cache (the dashboard refreshes every
15 s while the data moves in 5-minute steps); concurrent callers share one in-flight request and failures are
never cached.

## 8. Pages

Entry: `/` redirects to `/dashboard`. `proxy.ts` lets only `/sign-in`, `/sign-up`, `/forgot-password` and
`/not-invited` through unauthenticated; the dashboard layout then checks the person's record and role, and every
action checks again.

### Client (`USER`)

| Route | What it shows |
|---|---|
| `/dashboard` | Overview: fleet health, stat cards, latency and traffic panels, device list, alerts card, device map |
| `/dashboard/devices` | The client's devices (table + map), grouped, with quota bar |
| `/dashboard/devices/new` | The add-device wizard: host → probes → SNMP login → **real test result** → save |
| `/dashboard/devices/[id]` | Device detail: health panel, uptime ribbon, spec sheet, metric charts, interface table and summaries, traffic history and volume, incidents, change feed, settings |
| `/dashboard/incidents` · `/dashboard/incidents/[id]` | Incident list and detail sheet (acknowledge, delivery attempts, optional AI analysis) |
| `/dashboard/alerts` · `/new` · `/[id]` | Alert rules: overview, flow view, create/edit |
| `/dashboard/channels` | Notification channels (Telegram, webhook) and channel tests |
| `/dashboard/credentials` | Write-only secrets for those channels |
| `/dashboard/team` | The client's own users |
| `/dashboard/billing` | Plan, subscription state, payment history and chart, billing requests |
| `/dashboard/receipts/[id]` | A printable receipt |
| `/dashboard/profile` | Profile and security settings |

### Admin (`ADMIN`)

| Route | What it shows |
|---|---|
| `/dashboard` | Admin overview |
| `/dashboard/admin/organizations` | Clients; `[id]` has tabs for overview, devices (and device detail), billing and activity |
| `/dashboard/admin/plans` | Plans |
| `/dashboard/admin/payments` | Record and void payments |
| `/dashboard/admin/requests` | Client billing requests |
| `/dashboard/admin/users` | All users, invitations, bans |
| `/dashboard/admin/engine` | Engine health and orphan cleanup |
| `/dashboard/admin/audit` | Audit log |
| `/dashboard/admin/simulate` | Generate historical data for a chosen account's devices. **Currently disabled**: the menu entry is commented out in `lib/sidebar-menu.ts` and `proxy.ts` redirects the path to `/dashboard`. The service and engine endpoints are still in place |

`lib/sidebar-menu.ts` drives navigation: each item has `roles` and a `placement` — `top` (text in the top bar),
`rail` (icon in the left rail), or `hidden` (reached from another page, but still in the mobile menu and the
global search).

## 9. Selling: plans, subscriptions, payments

There is deliberately **no payment gateway, tax or invoicing**. A subscription is a *paid-until date*.

| Thing | Rule |
|---|---|
| Plan | Name, price per month, device slots, team members, fastest polling, price per extra slot. Once a client is on a plan, its price and limits are locked — create a new plan instead |
| Device limit | plan slots + bought extra slots. **Paused devices still count**, so pausing cannot free a slot |
| Payment | You record the money received (amount, method, reference, optional evidence link). It creates a numbered receipt (`RCP-2026-0001`), prints from the app, and applies what it paid for: activation, renewal (extends from the current end, or from today if already expired), extra slots, or an adjustment. **Voiding marks the receipt VOID and keeps it; it does not undo the change** |
| Extra slots | Sold per slot per month. Added mid-period, the form suggests a prorated amount (remaining days, rounded up to Rp 1,000); you can type what was really received |
| Expiry | **No grace period.** The moment the paid date passes, the client is read-only and the worker pauses their devices in the engine. Paying resumes only the devices the platform paused — one the client paused themselves stays paused |
| Downgrade | Refused while the client uses more than the new plan (plus bought slots) allows |
| Requests | Clients cannot change their own plan or slots. They send a request; you contact them, record the payment and mark it done |
| Poll interval | A client cannot ask for polling faster than their plan's `minPollIntervalSec` |

The pure rules live in `servers/billing/pricing.ts` (`deviceLimit`, `monthlyCost`, `isLive`, `addMonths`,
`periodAfterPayment`, `suggestExtraSlotsAmount`, `suggestRenewalAmount`, `receiptNumber`) and are unit tested,
along with `payment-stats.ts`.

## 10. The worker

`worker/index.ts` is the app's **only** background job. Every `WORKER_INTERVAL_SEC` (default 300) it:

1. marks subscriptions whose paid period ended as `EXPIRED` (`SubscriptionService.markExpired`),
2. frees slots reserved by a "create device" that never finished (`DeviceService.purgeStalePending`),
3. for every organization, pauses the devices of clients that are not paid up and resumes the ones *the platform*
   paused once they are (`DeviceMonitorService.syncOrgDevices` — safe to repeat).

It logs one JSON line per tick (`expiredSubscriptions`, `staleReservations`, `devicesChanged`, `devicesFailed`),
skips a tick while the previous one is still running, and shuts down cleanly on `SIGINT` / `SIGTERM` / `SIGHUP`.

Keep it running next to the web app — without it, expiry and device pausing never happen.

## 11. Tests and checks

```bash
npm test          # unit tests: pricing, payment stats, host policy, validators, authorization guards,
                  #             availability ribbon, incident stats, alert text
npm run typecheck
npm run lint
```

`npm run smoke` is an end-to-end check against the **real** database and a **running** engine — billing, quota
under concurrency, tenant isolation, expiry, suspension. It creates clearly named `smoke-*` data and removes it
again. It needs `ALLOW_PRIVATE_TARGETS=true` and, for the SNMP part, an SNMP agent whose port you pass as
`SMOKE_SNMP_PORT` (the engine's `../nms-monitoring/tests/helpers/fake-snmp-device.ts` works).

`npm run demo:alerts` seeds sample incidents, rules and channels for designing the alert pages; `-- --remove`
undoes it. Development only.

## 12. Known limits

* **Email alerts are not available** — the engine does not send email yet. Channels are Telegram and webhook.
* History retention is global in the engine, so it cannot differ per plan.
* The engine polls from one place: a client's device must be reachable from the engine's network (a public address,
  or a VPN).
* Billing emails do not exist; invoices and receipts are viewed and printed in the app.
* Nothing is invented: values the engine could not measure render as "—" or as the real error, never as a
  made-up number.
