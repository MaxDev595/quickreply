# Test report — QuickReply v1.0.0

Date: 2026-10-29. Package: `release/quickreply-extension-v1.0.0.zip` (SHA-256 `a09b82f0347b4c75a21aae1b5a033045aed0231a08899e7c10c2ead3edce591b`).

## Environment and what it means

The build machine had no full Chrome/Chromium that can load extensions (only a Chromium 153 headless shell). So:

- **Automatically verified:** the real built files from `dist/` (`content.js`, `popup.html`, `dashboard.html`) running in a real Chromium engine, with `chrome.storage`, `chrome.tabs`, `chrome.permissions` and `chrome.runtime` provided by a test harness (`apps/extension/e2e/harness`). Typing is real keyboard input, so the browser fires trusted `input` events and real `execCommand`, Selection and React behavior are exercised.
- **Not yet verified:** installing the unpacked extension in Chrome, the real `chrome.storage` backend, the popup ↔ content-script message in a real tab, the real `clipboardRead` prompt, and live third-party sites (Gmail etc.). These are in `docs/MANUAL_TESTING.md` and are **not** marked as passed.

## Results

| Suite | Result |
|---|---|
| TypeScript strict, all workspaces | Pass |
| ESLint (incl. no-eval, no-new-func, no innerHTML) | Pass, 0 problems |
| Unit, engine (`packages/shared`) | 53 / 53 pass |
| Unit, extension helpers (jsdom) | 18 / 18 pass |
| Integration, extension (Playwright + Chromium) | 43 / 43 pass, two consecutive runs |
| Integration, website | 4 / 4 pass |
| Build: extension + `check-dist` safety checks | Pass |
| Build: website static export | Pass, 8 static routes |

## Required scenarios (spec §10)

| # | Scenario | How | Status |
|---|---|---|---|
| 1 | Create snippet | Dashboard UI → storage → expands on a page | Pass (auto) |
| 2 | Edit snippet | Edit text, favorite, folder, Ctrl+S | Pass (auto) |
| 3 | Delete snippet | Confirmation dialog, cancel and confirm | Pass (auto) |
| 4 | Persist after browser restart | Persistent profile closed and relaunched; snippet listed and expands | Pass (auto, harness storage) · real Chrome: manual M3 |
| 5 | Input | Caret position, middle of text, selection, sensitive fields skipped | Pass (auto) |
| 6 | Textarea | Single and multi-line, Ctrl+Z restores shortcut | Pass (auto) |
| 7 | Contenteditable | Plain editor, Gmail-like editor, open shadow DOM | Pass (auto) · real Gmail: manual W1 |
| 8 | Multi-line text | Textarea, contenteditable, flattened in single-line input | Pass (auto) |
| 9 | React-controlled input | React 19 controlled input/textarea; state and submit keep value | Pass (auto) |
| 10 | Same shortcuts | Editor rejects duplicates; import renames/skips/replaces; `/hi` vs `/hire` | Pass (auto + unit) |
| 11 | Variables | `{date}`, fill-in form (input and rich), Escape cancels | Pass (auto) · `{clipboard}` with real permission: manual M6 |
| 12 | Import / export | Download, conflict dialog, broken file rejected, restore | Pass (auto + unit) |
| 13 | Disable extension | Global switch live on/off | Pass (auto) |
| 14 | Disable on a site | Excluded host vs other host; popup per-site toggle | Pass (auto) |
| 15 | After tab reload | Reload and expand | Pass (auto) |

Extra checks: paste does not expand, URLs (`site.com/hello`) do not expand, disabled snippets ignored, delimiter mode, local usage counter, dark theme, optional permission request, unsaved-changes guard.

## Bugs found and fixed during testing

- `{constructor}` in a template returned a function (prototype lookup) → own-property check.
- Search field collapsed in the dashboard (conflicting width classes) → separate base input class.
- Popup shortcut keycaps were truncated → layout fix.
- Fill-in field insert in the editor selected text one frame late, so fast typing landed in the wrong spot → synchronous selection.
