# Billing (TON / USDT) — test mode

Status: **test mode only** (TON testnet). Paid features (sync, version history, teams, roles) are not built yet, so the Chrome Web Store build contains no billing code and the public site shows paid plans as "Coming soon".

## Plans

| Plan | Price | Period | Devices |
|---|---|---|---|
| Free | $0 | — | up to 5 snippets (`FREE_SNIPPET_LIMIT`), all expansion features |
| Pro Monthly | $3.99 | 30 days | 3 |
| Pro Annual | $29 | 365 days (recommended) | 3 |
| Business | $7.99 per user | 30 days | 1 per seat |

Defined once in `packages/shared/src/billing.ts` and used by the API, the website and the extension.

## Free limit: 5 snippets

- Enforced in one place, `updateLibrary()` in `apps/extension/src/lib/storage.ts`: any change that would grow the library past the limit (new snippet, duplicate, examples, import, restore) throws `SnippetLimitError`, and the UI shows an "Upgrade to Pro" dialog. Nothing is saved in that case; text typed in the editor stays.
- Expansion is never limited: every saved snippet keeps working, however many times it's used.
- Libraries already over the limit (created before limits, or after a paid plan ran out) are kept: those snippets keep working and can be edited or deleted, only adding is blocked.
- The plan comes from the server; the extension uses the last confirmed plan, so it works offline. An expired plan falls back to Free.
- Applies only in builds with `VITE_BILLING_API`. A build without it has no plans and no limit, so build the launch version with the production API URL.

## How a payment works

1. In the extension: Settings → Plan → **Upgrade**. Opens `/pricing/?install=<id>` on the website. The install id is a random UUID stored in `chrome.storage.local`, with no personal data.
2. The buyer picks a plan (and seats for Business) and a currency (USDT on TON or Toncoin). The site calls `POST /v1/invoices`.
3. The invoice has an amount, the receiving address and a unique comment `QR-XXXXXXXX`. The page shows a QR code plus "Open in wallet" / Tonkeeper links with everything pre-filled, and expires in 60 minutes (+30 minutes grace for slow confirmations).
4. **The script settles it automatically.** A cron runs every minute (and the checkout page triggers a throttled check every 5 s). It reads the wallet's recent events from TonAPI and matches transfers to open invoices, then issues or extends the license.
5. The checkout shows "Payment received" and the license key. The extension picks up the plan on focus or Refresh. The key can be activated on other devices; for Business, one activation per seat.

Buying again extends the current plan of the same tier (e.g. Pro Monthly then Pro Annual = 30 + 365 days on the same key).

## Payment matching rules (`apps/api/src/match.ts`)

- Only finished events (`in_progress: false`) and successful actions (`status: ok`).
- Recipient must be the receiving wallet (compared as raw `0:<hex>`).
- Comment must equal the invoice comment (case and surrounding spaces ignored).
- TON: `TonTransfer` amount ≥ invoice amount.
- USDT: `JettonTransfer` whose **jetton master is on the allowlist** (`USDT_MASTERS`). Name and symbol are never trusted, because anyone can mint a fake "USDT".
- Under-payments don't settle. Over-payments do.
- Every on-chain event can pay one invoice once (`payments.event_id` is the primary key).

## Components

| Path | What |
|---|---|
| `apps/api` | Cloudflare Worker + D1: invoices, scanning, licenses. `wrangler.toml` holds public config. |
| `apps/api/migrations/0001_init.sql` | Schema: invoices, payments, licenses, activations, state |
| `apps/website/src/app/pricing` + `components/Checkout.tsx` | Pricing page; checkout appears only when `NEXT_PUBLIC_BILLING_API` is set |
| `apps/extension/src/lib/billing.ts`, `dashboard/PlanSection.tsx` | Plan section, only in `npm run build:testnet` builds (`dist-testnet/`) |

## Configuration

`apps/api/wrangler.toml` `[vars]` (public):

| Var | Test value | Notes |
|---|---|---|
| `TON_NETWORK` | `testnet` | `mainnet` only when going live |
| `PAY_TO` | `UQDAN7…T6_sS` | Receiving wallet. Replace with your own any time. |
| `USDT_MASTERS` | empty | Mainnet USDT: `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs`. Testnet has no official USDT, so test mode takes TON only. |
| `TEST_PRICE_DIVISOR` | `100` | Testnet faucets give little TON. Ignored on mainnet. |
| `ALLOWED_ORIGINS` | `http://localhost:3000,chrome-extension://*` | Add the production site origin |

Secret: **`TONAPI_KEY`** (TON Console). Locally in `apps/api/.dev.vars` (git-ignored). In Cloudflare: `npx wrangler secret put TONAPI_KEY`. It is never in the extension or the website.

## Tests

| Command | What |
|---|---|
| `npm test -w @quickreply/api` | 17 unit tests: addresses/checksums, pricing, matching (fake USDT, under-payment, replay, time window) |
| `npm run test:int -w @quickreply/api` | 15 integration tests: real Worker + local D1 + mock TonAPI, incl. cron settlement and B2B seats |
| `QR_BILLING_E2E=1 npx playwright test -c playwright.real.config.ts billing` (in apps/extension) | Real Chromium: extension → checkout → payment → plan active; Business key on a second profile |

## Live testnet test on Windows

Run `run-billing-testnet.cmd`. It installs everything, starts the API (port 8787) and the site (port 3000), and builds the test extension into `apps\extension\dist-testnet`. Then:

1. Load `apps\extension\dist-testnet` in Chrome as an unpacked extension (remove the normal QuickReply first).
2. Tonkeeper → Settings → switch to **Testnet**, then get free test TON from the testnet faucet bot (@testgiver_ton_bot in Telegram).
3. Extension → Settings → Plan → Upgrade → choose a plan → Toncoin → Continue → pay from Tonkeeper (testnet).
4. Within about a minute the page shows "Payment received" and the extension shows the plan.

## Before taking real money (not done)

1. Build the paid features first; until then keep production on "Coming soon".
2. Cloudflare: `wrangler d1 create quickreply-billing`, put the id in `wrangler.toml`, `npm run deploy -w @quickreply/api`, set `TONAPI_KEY` secret.
3. Set `TON_NETWORK=mainnet`, `USDT_MASTERS` to the mainnet USDT master, the production origin in `ALLOWED_ORIGINS`.
4. Harden verification. TonAPI documents its "actions" as a best-effort view. For mainnet, additionally confirm each settled payment from raw transactions: the USDT `transfer_notification` (op `0x7362d09c`) must come from *our* jetton wallet, derived with `get_wallet_address(PAY_TO)` on the USDT master.
5. Store license keys hashed (SHA-256) instead of plain text.
6. Update the Privacy Policy and the Store "Privacy practices": the extension would then contact the billing server (install id, plan status).
7. Rotate the TON Console API key that was shared in chat.
8. Get a legal/tax review for accepting crypto in your jurisdiction.

## Keys needed

| For | What | Status |
|---|---|---|
| Test mode | TON Console API key | provided (rotate later) |
| Test mode | Receiving wallet | provided |
| Production | Cloudflare account: API token (Workers + D1 edit) and account ID | needed to deploy |
| Production (optional) | Email service (e.g. Resend) | only if you want emailed receipts or license keys |
| — | License signing / encryption keys | not needed: entitlements are checked on the server |
