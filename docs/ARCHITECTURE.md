# Architecture

## Packages

**`packages/shared`** — pure TypeScript, no DOM or Chrome APIs. Used by the extension and by the landing page demo, so both expand text with the same logic.

| Module | Responsibility |
|---|---|
| `types.ts` | `Snippet`, `Folder`, `Settings`, `UsageStats`, `ExportFile` |
| `matcher.ts` | Finds the shortcut ending at the caret (longest match, word boundary, instant vs delimiter mode, prefix-conflict handling) |
| `variables.ts` | `{date}`, `{time}`, `{datetime}`, `{clipboard}`, custom fill-in fields. Plain string substitution, never evaluated |
| `shortcut.ts` | Shortcut validation and unique-name generation |
| `importExport.ts` | Backup format, defensive parsing of untrusted files, merge/restore with conflict strategies |
| `sites.ts` | Normalizes site input, matches excluded hosts incl. subdomains |
| `billing.ts` | Plans, prices, `FREE_SNIPPET_LIMIT` (5) and limit checks shared by the extension, site and API |

**`apps/extension`**

| Path | Responsibility |
|---|---|
| `src/content/index.ts` | Content script entry: loads storage, subscribes to changes, answers the popup's page-info message |
| `src/content/expander.ts` | Listens to trusted `input` events, matches, prompts for variables, replaces text |
| `src/content/fields.ts` | Which elements are editable; sensitive-field detection |
| `src/content/textAccess.ts` | Reads only the last N characters before the caret (N = longest shortcut + 2) |
| `src/content/insert.ts` | Replacement via `execCommand('insertText')` with native-setter fallback; rich text via Selection API |
| `src/content/variablePrompt.ts` | Fill-in form in a closed Shadow DOM, built with `textContent` only |
| `src/lib/storage.ts` | `chrome.storage.local` access, read-modify-write updates, change subscription |
| `src/lib/messages.ts` | The single runtime message type, with validators |
| `src/popup/*` | 380×500 popup |
| `src/dashboard/*` | Full-tab dashboard: sidebar, list, editor, settings (hash routing) |
| `src/ui/*` | Design tokens, shared components, theme, actions |

## Expansion flow

1. User types in a field → browser fires a trusted `input` event with `inputType: "insertText"`.
2. Expander ignores it if QuickReply is off, the site is excluded, a fill-in form is open, the event is synthetic, an IME composition is in progress, or the field is sensitive.
3. It reads at most `lookBehind` characters before the caret and asks the matcher for a match.
4. If the snippet has fill-in fields, it records the exact range of the shortcut and shows the form. Cancel leaves the text untouched.
5. It renders the template and replaces the shortcut:
   - fields: `setSelectionRange` + `execCommand('insertText')` (keeps undo and fires native events, so React/Vue state stays in sync); fallback: native value setter + `input` event.
   - contenteditable: `Selection.modify` extends backwards over the shortcut, verifies the selected text, then `insertText`/`insertLineBreak`.
6. A re-entrancy flag ignores the input events produced by the insertion itself.
7. A local usage counter is incremented.

## Storage

All data is in `chrome.storage.local` under `qr.*` keys. Extension pages update the library with a read-modify-write so the popup and dashboard never overwrite each other with stale copies. Content scripts react to `chrome.storage.onChanged`, so edits apply to open tabs immediately.

## Messaging

Only one message exists: the popup asks the content script in the active tab for its hostname (to offer "Expand on this site" without the `tabs` permission). The content script checks `sender.id === chrome.runtime.id` and validates the message shape. No `window.postMessage` is used, so web pages cannot talk to the extension.

## Build

- Pages: Vite multi-page build (`popup.html`, `dashboard.html`).
- Content script: separate Vite library build to a single IIFE (`content.js`), because content scripts can't be ES modules.
- `scripts/check-dist.mjs` fails the build on missing files, extra permissions, `eval`/`new Function`, remote scripts, module syntax or `innerHTML` in the content script.

## Landing page

Next.js App Router with `output: 'export'` → plain static files in `apps/website/out`, deployable to Cloudflare Pages without adapters. The hero demo imports `@quickreply/shared`, so it expands text with the real engine.

## Future plans (not implemented)

Pro/Business tiers, sync and team sharing need a backend with authentication and server-side entitlement checks. They are intentionally absent from v1; nothing in the UI suggests they exist.
