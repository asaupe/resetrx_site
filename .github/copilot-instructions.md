# Copilot instructions for ResetRx_site

## Big picture
- Static marketing site in root HTML files (e.g., [index.html](index.html)) styled by global CSS in [assets/styles/global.css](assets/styles/global.css).
- Serverless backend lives in [netlify/functions](netlify/functions) and handles Quest/KHSS appointments, lab results sync, scoring, and notifications (see architecture doc: [ARCHITECTURE.md](ARCHITECTURE.md)).
- Content/templates: JSON plan content in [content](content) and HTML snippets in [html_files](html_files).

## Key integrations and data flow
- Suggestic GraphQL is the core data store; use the shared client in [netlify/functions/utils/api-wrapper.js](netlify/functions/utils/api-wrapper.js) (`SuggesticClient.query(...)`) for all GraphQL calls.
- Suggestic custom attributes are managed via helpers in [netlify/functions/utils/custom-attributes.js](netlify/functions/utils/custom-attributes.js) (e.g., `setCustomAttributeJSON`, `addToCustomAttributeArray`).
- Klaviyo events must go through [netlify/functions/utils/klaviyo-client.js](netlify/functions/utils/klaviyo-client.js) (`sendKlaviyoEvent`) to keep payloads consistent and handle API auth.
- Quest/KHSS appointment + results workflows are implemented as Netlify functions (examples: [netlify/functions/get-appointments.js](netlify/functions/get-appointments.js), [netlify/functions/sync-lab-results.js](netlify/functions/sync-lab-results.js)).

## Code conventions and patterns
- Netlify functions are CommonJS modules (`module.exports = ...`) and use `fetch` via `node-fetch` v2 (see [package.json](package.json)).
- Environment variables are required for external APIs (e.g., `KLAVIYO_PRIVATE_KEY` in [netlify/functions/utils/klaviyo-client.js](netlify/functions/utils/klaviyo-client.js)); prefer reading from `process.env` in functions.
- Keep PHI out of Klaviyo event properties (see privacy note in [ARCHITECTURE.md](ARCHITECTURE.md)).

## Developer workflow
- No build/test scripts in [package.json](package.json). For UI changes, open [index.html](index.html) directly in a browser.
- Netlify functions are plain Node handlers; keep changes localized in [netlify/functions](netlify/functions) and reuse utilities in [netlify/functions/utils](netlify/functions/utils).

## When adding or updating backend logic
- Reuse `SuggesticClient` and the custom-attributes helpers instead of inline GraphQL or JSON parsing.
- Send all marketing/notification events through `sendKlaviyoEvent` rather than calling Klaviyo APIs directly.
