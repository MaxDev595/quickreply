# QA report — QuickReply v1.0.0

Date: 2026-10-29. Final package: `release/quickreply-extension-v1.0.0.zip`, SHA-256 `24d8a0d0e87e355d836ba494b92c8bef8b3e6ed48255c7c2900a482b638c87a5` (21 files).

## Status: extension READY · submission blocked by launch items (site, support email)

All 44 checks pass. The one bug found in the user's Chrome ({clipboard} inserted nothing, QA-4) was fixed, verified in Chromium and re-checked by the user in Chrome ("Отлично все работает", 2026-10-29 20:07). No open product bugs block release. Submission is blocked only by launch items outside the code: a real support email and the published site with the privacy policy URL.

## Summary (44-item checklist)

| Result | Count |
|---|---|
| PASS | 44 |
| FAIL | 0 |
| NOT TESTED | 0 |

Additional checks beyond the 44: 3.8, 3.9, 6.6, 7.7, all PASS. Real-Chromium suite: 43 tests (41 checklist + 2 clipboard), all pass on the final ZIP.

## How it was tested

| Environment | What it covers |
|---|---|
| **Chromium 156.0.8078.73** (full browser, ungoogled-chromium build), extension loaded unpacked **from the final ZIP**, real `chrome.*` APIs, no shims | 43 automated checks in `apps/extension/e2e-real/` (`qa.spec.ts`, `clipboard.spec.ts`), mapped to checklist IDs. Run: `npm run test:real -w @quickreply/extension` (set `CHROME_PATH`). |
| **Google Chrome on the user's Windows PC**, extension installed unpacked from the release ZIP | Expansion of `/hello` on the QA page confirmed by the user (screenshot). Landing checks 7.1–7.5 and Google Docs (3.7) by the Claude in Chrome agent. |
| Chromium + `chrome.*` test harness | 43 integration tests (`npm run test:e2e`), unchanged, still pass. |
| Unit tests | 53 engine + 18 extension helper tests pass. |
| Static checks | TypeScript strict and ESLint (incl. no `eval`/`innerHTML`): 0 errors. `check-dist`: passes. |

Google-branded Chrome 137+ ignores `--load-extension`, so the automated real-browser suite uses Chromium, which has the same extension system. Branded Chrome was covered by the manual checks listed above.

## Results

| ID | Check | Status | Evidence |
|---|---|---|---|
| 1.1 | Popup: logo, On, settings | PASS | Chromium real ext |
| 1.2 | Dashboard and Options page open | PASS | Chromium real ext; also seen open in user's Chrome |
| 1.3 | No errors in extension pages | PASS | Chromium real ext (console + pageerror captured) |
| 1.4 | Data and expansion survive browser restart | PASS | Chromium, same profile relaunched |
| 1.5 | Permissions | PASS | Granted: `storage` + `<all_urls>` (content script); `clipboardRead` optional, not granted at install; no `host_permissions` |
| 2.1 | Input, caret at end | PASS | Chromium real ext; user confirmed in Chrome |
| 2.2 | Textarea multi-line | PASS | Chromium real ext |
| 2.3 | Ctrl+Z restores shortcut | PASS | Chromium real ext |
| 2.4 | No expansion inside URL | PASS | Chromium real ext, with positive control |
| 2.5 | `/hi` waits for space | PASS | Chromium real ext |
| 2.6 | `/hire` expands | PASS | Chromium real ext |
| 2.7 | Disabled snippet ignored, live in open tab | PASS | Chromium real ext |
| 2.8 | Paste does not expand | PASS | Chromium real ext |
| 3.1 | contenteditable, no HTML injected | PASS | Chromium real ext |
| 3.2 | Gmail-style editor, new line | PASS | Chromium real ext |
| 3.3 | Open shadow DOM | PASS | Chromium real ext |
| 3.4 | React 19 controlled input + submit | PASS | Chromium real ext |
| 3.5 | Iframe | PASS | Chromium real ext |
| 3.6 | Gmail compose | PASS | Live Gmail (user's account, signed in by the user) in the Claude desktop browser. That browser cannot install Chrome extensions, so the content script from the final ZIP was injected into the Gmail page with an in-memory storage stand-in (only the fill-in form's CSS was shortened). Results: body `/hello` → full text; `/multi` → 3 lines with breaks; `/greet` → form shown over Gmail, `Ana`/`Acme` inserted; subject `/hi ` → `Hi! `. Ctrl+Z removes the expansion together with the typed shortcut (see QA-3). Nothing was sent; the draft was emptied and closed. |
| 3.7 | Google Docs | PASS | Real Chrome (agent): does not expand, as documented (canvas editor) |
| 4.1 | `{date} {time}` | PASS | Chromium real ext |
| 4.2 | Fill-in form | PASS | Chromium real ext |
| 4.3 | Escape cancels | PASS | Chromium real ext |
| 4.4 | Variable buttons + preview | PASS | Chromium real ext |
| 4.5 | Validation: empty name, duplicate | PASS | Chromium real ext |
| 4.6 | `{clipboard}` after granting permission | PASS (after fix) | User's Chrome: permission granted, text copied, `/clip` inserted nothing (QA-4). Fixed. After the fix, in Chromium with `clipboardRead` granted and `navigator.clipboard` disabled: `Copied: banana` in an input and in contenteditable, focus returns to the field, no leftover elements; without the permission: `Copied: ` and nothing breaks (`e2e-real/clipboard.spec.ts`). Permission off by default and toggle not turned on without a grant: PASS. Re-checked by the user in Chrome with the fixed build: works. |
| 5.1 | Search (popup and dashboard) | PASS | Chromium real ext |
| 5.2 | Folders | PASS | Chromium real ext |
| 5.3 | Favorites | PASS | Chromium real ext |
| 5.4 | Recently used | PASS | Chromium real ext |
| 5.5 | Duplicate → `/hello2` | PASS | Chromium real ext |
| 5.6 | Delete confirmation | PASS | Chromium real ext |
| 5.7 | Dark theme (dashboard + popup) | PASS | Chromium real ext; dark dashboard also seen in user's Chrome |
| 6.1 | Password field ignored | PASS | Chromium real ext, with positive control |
| 6.2 | Card number / OTP / opted-out ignored | PASS | Chromium real ext, with positive control |
| 6.3 | Excluded site and removal | PASS | Chromium real ext |
| 6.4 | Popup site detection | PASS | Chromium real ext: content script answers `localhost`; `chrome://` and extension pages answer "unavailable". Popup rendering of both states covered by harness tests. |
| 6.5 | Global switch | PASS | Chromium real ext |
| 7.1 | Landing demo autoplay | PASS | Real Chrome (agent) |
| 7.2 | Demo `/pricing` | PASS | Real Chrome (agent) |
| 7.3 | Honest "Coming soon" CTA | PASS | Real Chrome (agent) |
| 7.4 | Anchors + FAQ | PASS | Real Chrome (agent) |
| 7.5 | Privacy / Terms / Contact | PASS | Real Chrome (agent) |
| 7.6 | Export / import / conflicts / broken file / restore | PASS | Chromium real ext |
| 3.8 | Tab opened before snippets existed | PASS | Expands without reload |
| 3.9 | Tab opened before extension reload | PASS | Keeps working |
| 6.6 | No network requests while expanding | PASS | Zero requests recorded |
| 7.7 | `qa-snippets.json` imports via UI | PASS | 7 snippets |

## Bugs found during this QA

| ID | Priority | Description | Status |
|---|---|---|---|
| QA-1 | P2 | `options_ui.page` was `dashboard.html#/settings`. A fragment in the options path is risky in Chrome. | Fixed: now `dashboard.html`. Verified with `chrome.runtime.openOptionsPage()` (1.2). The build the user installed from the Desktop predates this fix. |
| QA-4 | P2 | `{clipboard}` inserted nothing in real Chrome even with `clipboardRead` granted. Cause: the content script used `navigator.clipboard.readText()`, which Chrome checks against the **page's** clipboard permission, not the extension's, so it fails silently on real sites. Automation hid this because it grants page clipboard access. | Fixed: content script now reads via `document.execCommand('paste')` into a temporary hidden textarea (the method Chrome documents for `clipboardRead`), with `readText()` as fallback (`src/content/clipboard.ts`). Verified in Chromium and re-checked by the user in Chrome. |
| QA-2 | Tooling | The QA page server crashed on any 404 (e.g. `favicon.ico`), so Chrome got `ERR_CONNECTION_REFUSED`. | Fixed in `qa/serve.mjs`. Not part of the extension. |
| QA-3 | P3 | In Gmail, one Ctrl+Z after an expansion removes the expanded text **and** the typed shortcut, instead of restoring the shortcut. Gmail groups typing into its own undo step. Plain inputs, textareas and simple editors restore the shortcut (2.3). | Known limitation, documented. Not a release blocker. |

No P0 or P1 product bugs were found.

## Observations

- **The first agent run reported 12 × P0 "nothing expands".** The cause was test setup, not the product: the extension had 0 snippets at that time (seen on screen: "No snippets yet"). After importing, the user confirmed `/hello` expanding in Chrome.
- **Site access:** the user checked extension details and confirmed the setting ("готово", 19:41).
- **Unexplained: in the Claude in Chrome agent's own tabs, expansion still didn't happen after import**, while it worked in the user's tab of the same Chrome. Not reproducible in Chromium: new tabs, tabs opened before import (3.8) and tabs opened before an extension reload (3.9) all expand. Possible causes not yet ruled out: site access set to "On click" in the extension details, or how the agent's tab group interacts with extensions. Recommended 1-minute check: extension details, "Site access", should read "On all sites"; then type `/hello` in a new tab.
- Gmail test left one empty draft in "Drafts" (Gmail keeps an empty draft after a compose window is closed). The user can delete it; nothing was sent.

## Chrome Web Store compliance (final ZIP)

- Manifest V3, `minimum_chrome_version` 116, icons 16/32/48/128 RGBA PNG.
- Permissions: `storage`; content script on `<all_urls>`; `clipboardRead` optional. No `host_permissions`, no background worker, no `tabs`.
- No remote code: no `eval`, `new Function`, remote scripts or imports; no source maps; content script is a readable 14.4 KB IIFE with no `innerHTML` assignment.
- Single purpose and data-use justifications: `docs/PERMISSIONS.md`. Listing text: `docs/STORE_LISTING.md`. Reviewer notes: `docs/REVIEWER_NOTES.md`.
- The listing must not mention other products' brands: checked, none.

## Remaining before submission

1. Set a real support email (`NEXT_PUBLIC_CONTACT_EMAIL`) and deploy the site, so the privacy policy URL exists for the listing.

When that is done, the package can be submitted.
