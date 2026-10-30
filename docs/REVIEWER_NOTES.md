# Notes for the Chrome Web Store reviewer

QuickReply is a text expander. It needs no account. The Free plan allows 5 snippets; paid plans (bought on our website with crypto) remove the limit. The extension's dashboard checks the plan with our billing API using a random install ID; nothing else is sent.

## How to test (2 minutes)

1. Install the extension and click its toolbar icon.
2. In the popup, click **Add examples**. Three snippets are created: `/hello`, `/followup`, `/today`.
3. Open any page with a text box (for example https://www.google.com/search or a Gmail compose window) and type `/hello`. It is replaced with "Hello! Thank you for contacting us. How can I help you today?"
4. Type `/followup`. A small form asks for "Name". Type a name and press Enter; the text is inserted with the name.
5. Type `/today` to insert today's date.
6. Open the dashboard (popup → Open dashboard) to create, edit, delete snippets, and see Settings.

## Why access to all sites is needed

Users type in many different web apps. The content script must be present in any page with a text field to detect a shortcut as it's typed. It reads only the last few characters before the cursor, in memory, and only in editable fields. It never reads password, payment or one-time-code fields, never stores what the user types, and makes no network requests.

## Optional permission

`clipboardRead` is optional and requested only if the user enables the `{clipboard}` variable in Settings.

## Code

No remote code, no `eval`, no obfuscation. The content script is a single readable bundle (`content.js`, ~14 KB).
