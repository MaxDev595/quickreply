# Publishing guide

Nothing has been published yet. These are the steps to do it.

## 1. Website on Cloudflare Pages

1. Push the repository to GitHub.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → choose the repo.
3. Build settings:
   - Framework preset: **None** (static export)
   - Build command: `npm ci && npm run build:website`
   - Build output directory: `apps/website/out`
   - Environment variables:
     - `NODE_VERSION` = `22`
     - `SITE_URL` = your production URL, e.g. `https://quickreply.example` (used for canonical, sitemap, Open Graph)
     - `NEXT_PUBLIC_CONTACT_EMAIL` = a real support address
     - `NEXT_PUBLIC_CHROME_STORE_URL` = leave empty until the extension is live (the site shows "Coming soon")
4. Deploy. Check `/privacy/`, `/terms/`, `/contact/`, `/sitemap.xml`, `/robots.txt`.

## 2. Chrome Web Store

1. Register a developer account at https://chrome.google.com/webstore/devconsole (one-time registration fee).
2. Build the package: `npm ci && npm run package:extension` → `release/quickreply-extension-v1.0.0.zip`.
3. Developer console → **New item** → upload the ZIP.
4. **Store listing**: copy text from `docs/STORE_LISTING.md`, upload the icon and screenshots.
5. **Privacy practices**: single purpose and permission justifications from `docs/PERMISSIONS.md`; data usage: no data collected; privacy policy URL from step 1.
6. **Distribution**: Public; regions as needed (primary market US/English).
7. Add the reviewer notes from `docs/REVIEWER_NOTES.md` in the "Notes for reviewer" field if available.
8. Submit for review. Broad host access usually means an in-depth review that can take longer than usual.

## 3. After approval

1. Set `NEXT_PUBLIC_CHROME_STORE_URL` in Cloudflare Pages to the listing URL and redeploy. The CTA switches to a real "Add to Chrome — Free" link.
2. Capture a real Gmail screenshot and add it to the listing.

## Releasing updates

1. Bump `version` in `apps/extension/public/manifest.json` (and `package.json`).
2. `npm run check && npm run test:e2e && npm run package:extension`.
3. Upload the new ZIP to the existing item.
