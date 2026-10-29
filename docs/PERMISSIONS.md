# Permission justifications (for the Chrome Web Store "Privacy practices" tab)

## Single purpose

QuickReply has one purpose: replacing short shortcuts the user types in text fields with text snippets the user saved.

## `storage`

Stores the user's snippets, folders, settings and local usage counts in `chrome.storage.local`. Nothing is synced or sent off the device.

## Host access via content script on `<all_urls>`

Text expansion must work in whatever text field the user is typing in: email, CRMs, help desks, forms. The content script listens for typing in editable fields, looks at the last few characters before the cursor (in memory, never stored or transmitted), and replaces a matching shortcut with the user's snippet. Password, payment and one-time-code fields are skipped. `activeTab` is not sufficient because it requires clicking the toolbar icon on every page, which defeats automatic expansion.

## `clipboardRead` (optional)

Requested only when the user turns on the `{clipboard}` variable in Settings. Used only at the moment a snippet containing `{clipboard}` is inserted. Not requested at install.

## Remote code

None. All code ships in the package. No `eval`, `new Function`, remote scripts or remotely loaded configuration.

## Data usage disclosures

- Collected data: none. QuickReply does not collect or transmit user data.
- Website content / personal communications: processed locally only to detect shortcuts; not stored, not transmitted.
- Certify: not sold to third parties; not used for unrelated purposes; not used for creditworthiness or lending.
