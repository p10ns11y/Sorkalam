---
name: sorkalam
description: >
  Sorkalam MV3 Chrome extension (Tamil ↔ English). Use when editing popup.js, event.js,
  content.js, manifest.json, or dictionary lookup behavior in this repo.
---

# Sorkalam extension (this repo)

Vanilla MV3 extension: Wiktionary + Tamil VU glossary. No frameworks in the active path.

## Files

| File | Role |
|------|------|
| `popup.js` | UI, Wiktionary fetch, Tamil VU via `sendMessage`, `normalizeInput()` |
| `glossary-cache.js` | IndexedDB cache for Tamil VU HTML + parsed entries (popup + SW) |
| `tamilvu-glossary-parse.js` | HTML table → `{ columns, rows }` JSON via `DOMParser` (popup only) |
| `event.js` | Service worker: selection relay, Tamil VU fetch + IDB HTML cache |
| `content.js` | `lastCapturedSelection`, answers `getSelectedWord` |
| `manifest.json` | MV3 permissions, `<all_urls>` content script |

Full architecture: [TECH_DETAILS_V6.md](../../../TECH_DETAILS_V6.md).

## Message actions (keep names consistent)

| Action | Sender → receiver | Response |
|--------|-------------------|----------|
| `getSelectedWordFromPage` | popup → `event.js` | `{ selectedWord }` |
| `getSelectedWord` | `event.js` → content script | `{ selectedWord }` |
| `fetchTamilVUGlossary` | popup → `event.js` | `{ ok, glossaryPageHtml, fromCache?, cacheKey }` or error |

Popup: check `GlossaryCache.getTamilVu` for `glossaryEntries` first; else parse HTML and `setTamilVu` with table + entries. SW caches HTML on network fetch. Flow diagram: [TECH_DETAILS_V6.md — Tamil VU Glossary](../../../TECH_DETAILS_V6.md#lookup-tamil-vu-glossary).

## Rules for changes

1. **Async `sendResponse`**: use async IIFE + `return true` in `event.js` (see [references/message-passing.md](references/message-passing.md)).
2. **Tamil VU**: never `fetch` tamilvu.org from the popup — use `event.js` + `host_permissions` (HTTPS only).
3. **English input**: lowercase via `normalizeInput()` before Tamil VU / Wiktionary.
4. **Selection**: cache in content script; popup opens often clear live `getSelection()`.
5. **Icons**: only reference PNGs that exist, or omit from manifest.

## MV3 references (local)

- [message-passing.md](references/message-passing.md) — popup ↔ service worker ↔ content script
- [service-worker.md](references/service-worker.md) — `event.js` lifecycle
- [content-scripts.md](references/content-scripts.md) — `content.js` on pages

## Upstream (do not vendor into this repo)

- Chrome extensions (full skill): [GoogleChrome/modern-web-guidance — chrome-extensions](https://github.com/GoogleChrome/modern-web-guidance/tree/main/skills/chrome-extensions)
- Popup HTML/CSS patterns: [modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance/tree/main) — use `npx -y modern-web-guidance@latest search "…"` when needed, not a local copy of all guides.
