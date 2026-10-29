# Manual test checklist (real Chrome)

Automated tests run the built extension code in Chromium through a `chrome.*` API harness (see TEST_REPORT.md). The steps below check what only a real Chrome install can confirm. Mark each line with the date and result; don't mark a line as passed without doing it.

## Setup

1. `npm run build:extension`, then `chrome://extensions` → Developer mode → Load unpacked → `apps/extension/dist`.
2. Confirm: no errors on the extension card; install warning lists only "Read and change all your data on all websites".
3. Popup → **Add examples**.

## Extension loading and storage

| # | Check | Result |
|---|---|---|
| M1 | Popup opens at 380×500, shows On, settings and the 3 example snippets | |
| M2 | "Open dashboard" opens a tab; Settings icon opens `#/settings`; right-click icon → Options opens Settings | |
| M3 | Create a snippet in the dashboard, close Chrome completely, reopen: snippet is still there and expands | |
| M4 | Popup on `chrome://extensions` shows "Not available on this page" | |
| M5 | Popup on a normal site shows "Expand on <site>"; switching it off stops expansion there after typing again | |
| M6 | Turning on "Allow {clipboard}" shows Chrome's permission prompt; a snippet with `{clipboard}` inserts copied text | |

## Websites

| # | Site / field | Steps | Result |
|---|---|---|---|
| W1 | Gmail compose body | type `/hello`, then `/followup` with a name, then Ctrl+Z | |
| W2 | Gmail To / Subject | `/hello` in Subject expands | |
| W3 | Google search box | `/hello` expands | |
| W4 | GitHub issue comment (textarea) | `/followup` keeps line breaks | |
| W5 | Slack / Notion (slash-command apps) | with prefix `;` in Settings, `;hello` expands; with `/`, note conflicts | |
| W6 | LinkedIn message box (contenteditable) | `/hello` expands | |
| W7 | A React app form (e.g. any signup form) | expanded value is kept after blur / submit | |
| W8 | Google Docs | Expected: does NOT expand (canvas editor). Record result | |
| W9 | Any login form password field | `/hello` is NOT expanded | |
| W10 | Excluded site | add site in Settings → no expansion; remove → works again after typing | |

## Known limitations to verify/document

- Google Docs, Sheets and other canvas-based editors are not supported.
- Cross-origin iframes: the content script runs in all frames, so most embedded editors work, but sandboxed iframes may not.
- Closed shadow DOM editors are not reachable.
- In a few editors with their own undo stacks, Ctrl+Z may behave differently.
