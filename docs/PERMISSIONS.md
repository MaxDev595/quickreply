# Permission justifications (for the Chrome Web Store "Privacy practices" tab)

## Single purpose

QuickReply has one purpose: replacing short shortcuts the user types in text fields with text snippets the user saved.

## `storage`

Stores the user's snippets, folders, settings and local usage counts in `chrome.storage.local`, plus a random install ID and the last known plan. Snippets are never synced or sent off the device.

## Host access via content script on `<all_urls>`

Text expansion must work in whatever text field the user is typing in: email, CRMs, help desks, forms. The content script listens for typing in editable fields, looks at the last few characters before the cursor (in memory, never stored or transmitted), and replaces a matching shortcut with the user's snippet. Password, payment and one-time-code fields are skipped. `activeTab` is not sufficient because it requires clicking the toolbar icon on every page, which defeats automatic expansion.

## `clipboardRead` (optional)

Requested only when the user turns on the `{clipboard}` variable in Settings. Used only at the moment a snippet containing `{clipboard}` is inserted: the content script reads the clipboard with `document.execCommand('paste')` into a temporary, immediately removed textarea and inserts the text. The clipboard content is never stored or transmitted. Not requested at install.

## Remote code

None. All code ships in the package. No `eval`, `new Function`, remote scripts or remotely loaded configuration.

## Network access (billing)

No extra permission is needed. Only the extension's own pages (dashboard, settings) call the QuickReply billing API (Cloudflare Worker, URL in `packages/shared/src/production.ts`) to read the plan for a random install ID and to activate license keys. The content script never makes network requests.

## Data usage disclosures

- Collected data: none of the listed personal-data categories (personally identifiable info, health, financial and payment info, authentication info, personal communications, location, web history, user activity, website content). The extension sends only a random install ID and, if the user enters one, a license key, to check the plan. Payments are made in the user's own crypto wallet, outside the extension. In the dashboard form, answer "no" to every category; the privacy policy explains the install ID.
- Website content / personal communications: processed locally only to detect shortcuts; not stored, not transmitted.
- Certify: not sold to third parties; not used for unrelated purposes; not used for creditworthiness or lending.
