# NMS TAM

A multi-client network monitoring service. Clients add their own devices (routers, switches, servers) and see real
health, metrics, interface traffic, incidents and alerts. You sell it in plans with a device quota, and record payments
by hand.

```
Browser ──► this Next.js app ──► monitoring engine (../nms-monitoring, private, API key)
             Clerk login              polls devices with ICMP / TCP / SNMP
             plans, quota, payments   owns all monitoring data
             ownership of every object
```

* **Two roles.** `ADMIN` is your staff. `USER` is a client user who belongs to exactly one organization.
* **The browser never talks to the engine.** Every call goes through `servers/services/*`, which first proves the
  client owns the object (ownership records in this app's own database).
* **Nothing is invented.** Values the engine could not measure show as “—” or as a real error, never as a made-up number.

## Set up

### 1. Clerk (dashboard.clerk.com → your application)

The app is built for these settings; they can only be set in the Clerk dashboard, not from code:

| Setting | Value |
|---|---|
| User & authentication → Email address | Required, **verify at sign-up** (email code) |
| User & authentication → Password | On |
| User & authentication → Username / phone | Off (sign-in is by email) |
| Multi-factor authentication | Optional. Off is fine: sign-in is email + password, and Clerk asks for an email code on a new device |
| Restrictions → Sign-up mode | **Restricted** (invitation only) |

Sign-up is by invitation only: an admin invites a person, Clerk emails a link, and the link opens `/sign-up`. The
invitation proves the email address, so no code is asked there. On a new device Clerk may ask for an email code at
sign-in; accounts that turned on an authenticator app are asked for its code (or a backup code).

Two-step verification (authenticator app) is optional. To force it for admins, enable it in Clerk and set
`REQUIRE_ADMIN_MFA=true`; admins then see a setup screen until it is on.

### 2. Environment (`.env`, see `.env.example`)

`DATABASE_URL` (same database as the engine; this app uses schema `public`, the engine uses `nms_monitoring`),
the two Clerk keys, `ENGINE_URL`, `ENGINE_API_KEY` (one of the engine's `ENGINE_API_KEYS`), `APP_URL` (used in
invitation links). `ALLOW_PRIVATE_TARGETS` must be `false` in production.

### 3. Run

```bash
npm install
npx prisma migrate deploy
npm run create-admin -- you@company.com "Your Name"   # once: creates the first admin, prints a one-time password
npm run dev                                          # or: npm run build && npm start
npm run worker                                       # in a second terminal, keep it running
```

The engine must be running (`cd ../nms-monitoring && npm run build && npm start`). Then sign in, create a plan (**Plans**), create a client (**Clients**), record its first payment (activates the
plan), and invite its users (**Users**).

No Docker: run the app, the worker and the engine as three Node processes under any process manager (pm2, NSSM, systemd).

## Selling: plans, subscriptions, payments

There is deliberately no payment gateway, tax or invoicing. A subscription is a **paid-until date**.

| Thing | Rule |
|---|---|
| Plan | Name, price per month, device slots, team members, fastest polling, price per extra slot. Once a client is on a plan its price and limits are locked (create a new plan instead). |
| Device limit | plan slots + extra slots bought. Paused devices still count, so pausing cannot free a slot. |
| Payment | You record the money received (amount, method, reference, optional evidence link). It creates a numbered receipt (`RCP-2026-0001`), prints from the app, and applies what it paid for: activation, renewal (extends from the current end, or from today if it expired), extra slots, or an adjustment. Voiding marks the receipt VOID and keeps it; it does not undo the change. |
| Extra slots | Sold per slot per month. When you add them mid-period the form suggests a prorated amount (remaining days, rounded up to Rp 1,000); you can type what was really received. |
| Expiry | No grace period. The moment the paid date passes the client is read-only, and the worker pauses their devices in the engine. Paying resumes only the devices the platform paused; a device the client paused themselves stays paused. |
| Downgrade | Refused while the client uses more than the new plan (plus bought slots) allows. |
| Requests | Clients cannot change their own plan or slots. They send a request; you contact them, record the payment and mark it done. |

## How clients are kept apart

* Every page and server action starts with a guard (`lib/auth.ts`). Actions are public endpoints, so each one checks.
* The client's organization always comes from their own record, never from the request.
* Engine credential and channel names are prefixed per client (the engine requires them to be globally unique).
* A client's alert rule always targets one of their own devices. “All my devices” creates one rule per device.
* Hosts are checked before a test or save: private, loopback, link-local and reserved addresses are refused (including
  hostnames that resolve to one), so clients cannot make the platform probe your own network.
* Device slots are taken inside a locked transaction, so two simultaneous adds cannot both take the last slot.

## Check that it works

```bash
npm test          # unit tests: pricing, hosts, validation, authorization guards
npm run typecheck
npm run lint
```

`npm run smoke` is an end-to-end check against the real database and a running engine (billing, quota under
concurrency, tenant isolation, expiry, suspension). It creates `smoke-*` data and removes it again. It needs
`ALLOW_PRIVATE_TARGETS=true`, and for the SNMP part an SNMP agent whose port you give in `SMOKE_SNMP_PORT`
(the engine's test agent in `../nms-monitoring/tests/helpers/fake-snmp-device.ts` works).

## Layout

```
app/(auth)        sign-in (email + password + email/authenticator/backup code), sign-up (invitation), forgot-password
app/(dashboard)   /dashboard  client: devices, incidents, alerts, channels, credentials, team, billing, profile
                  /dashboard/admin  clients, plans, payments, requests, users, engine, audit
app/action        server actions: guard → validate → service → revalidate. They return { ok, data | error }
servers/validators   zod schemas
servers/services     the only code that touches Prisma or the engine
servers/engine       typed HTTP client for the engine + error translation
servers/billing      pure pricing rules (unit tested)
worker/              the one background job: expire subscriptions, pause/resume devices, free stale reservations
scripts/             create-admin, smoke
```

## Known limits

* Email alerts are not available (the engine does not send email yet); channels are Telegram and webhook.
* Retention of history is global in the engine, so it cannot differ per plan.
* The engine polls from one place. A client device must be reachable from the engine's network (a public address, or a VPN).
* Billing emails do not exist: invoices/receipts are viewed in the app.
