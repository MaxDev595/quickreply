# QuickReply — Text Expander & Auto Text

**Type Less. Get More Done.**

QuickReply is a Chrome extension (Manifest V3) that saves the messages you type every day and inserts them anywhere when you type a short shortcut such as `/hello`. Local-only: no account, no servers, no tracking.

```
quickreply/
├── apps/extension/   Chrome extension (React + Vite + Tailwind, MV3)
├── apps/website/     Landing page (Next.js static export → Cloudflare Pages)
├── packages/shared/  Framework-free engine: types, matcher, variables, import/export
├── docs/             Spec, architecture, permissions, store listing, publishing, testing
└── release/          Built Chrome Web Store ZIP (generated)
```

## Requirements

- Node.js 22.12+ and npm 10+
- For integration tests: a Chromium binary (`npx playwright install chromium`, or set `CHROMIUM_PATH`)

## Commands

| Command | What it does |
|---|---|
| `npm install` | Installs all workspaces |
| `npm run build:extension` | Builds the extension into `apps/extension/dist` |
| `npm run package:extension` | Builds and creates `release/quickreply-extension-v1.0.0.zip` |
| `npm run build:website` | Static export of the site into `apps/website/out` |
| `npm run typecheck` | TypeScript (strict) in every workspace |
| `npm run lint` | ESLint, including security rules (no `eval`, no `innerHTML`) |
| `npm test` | Unit tests (Vitest) for the engine and extension helpers |
| `npm run test:e2e` | Integration tests (Playwright) for the extension |
| `npm run test:e2e -w @quickreply/website` | Browser tests for the landing page |

## Load the extension locally

1. `npm install && npm run build:extension`
2. Open `chrome://extensions`, turn on **Developer mode**.
3. Click **Load unpacked** and choose `apps/extension/dist`.
4. Pin QuickReply, open the popup, click **Add examples**, then type `/hello` in any text field.

## Features (v1.0)

- Snippet CRUD, duplicate, enable/disable, favorites, folders, Recently used, search and sort
- Expansion in `<input>`, `<textarea>`, `contenteditable` (incl. Gmail-style editors, open shadow DOM) and React-controlled fields
- Native undo (Ctrl+Z) after expansion; caret placed after the inserted text; multi-line support
- Trigger modes: instant, or after a space/punctuation; similar shortcuts (`/hi` vs `/hire`) resolved automatically
- Variables: `{date}`, `{time}`, `{datetime}`, optional `{clipboard}`, and fill-in fields like `{name}` with a small form
- Global on/off, per-site off (from the popup or Settings), password/payment/OTP fields ignored
- JSON export/import with validation, conflict handling (keep both / skip / replace) and full restore
- Light, dark and system themes

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how it works and [docs/TEST_REPORT.md](docs/TEST_REPORT.md) for what was verified.
