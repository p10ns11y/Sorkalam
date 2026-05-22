# Sorkalam (சொற்களம்) — Technical Details (v6.0)

> **This document describes the current Manifest V3 extension in this repository.**  
> For the original v5.x design (Glosbe, jQuery, MV2), see **[TECH_DETAILS.md](TECH_DETAILS.md)**.  
> User-facing overview: **[README.md](README.md)**.

Sorkalam v6.0 is a Chromium extension (Brave, Chrome, Edge) for Tamil ↔ English lookups via **Wiktionary** and the **Tamil Virtual University technical glossary**. It uses vanilla JavaScript, a service worker, and a content script—no jQuery in the active lookup path.

---

## Core Architecture

| Component | File | Role |
|-----------|------|------|
| Popup UI | `popup.html`, `popup.js`, `css/popup.css` | Input, buttons, fetch lookups, render results |
| Service worker | `event.js` | Relays selected text from the active tab to the popup |
| Content script | `content.js` | Tracks and returns page text selection (`<all_urls>`) |
| Manifest | `manifest.json` | MV3 permissions, content script registration, CSP |

**Data flow (typical session)**

1. User selects text on a page → `content.js` caches it via `selectionchange` / `mouseup` / `keyup`.
2. User opens the popup → `popup.js` sends `{ action: 'getSelectedWordFromPage' }` to `event.js`.
3. `event.js` messages the tab’s content script (`{ action: 'getSelectedWord' }`) or falls back to `chrome.scripting.executeScript`.
4. Popup fills `#word`, runs `detectLanguage()`, and calls `performLookup('wiki')` if text is non-empty.
5. User may switch source with **Wiktionary** or **Tamil VU Glossary** buttons, or press **Enter** (Wiktionary default).

---

## Manifest V3

- **Version**: `6.0.0`
- **Action**: `default_popup` → `popup.html`
- **Background**: `event.js` as non-persistent service worker
- **Content scripts**: `content.js` on `<all_urls>`, `document_idle`
- **Permissions**: `tabs`, `storage`, `scripting`, `activeTab`
- **Host permissions**: `*.wiktionary.org`, `https://www.tamilvu.org/*`
- **CSP** (extension pages): `script-src 'self'; object-src 'self';`

`jquery-1.10.2.js` remains in the repo from the legacy tree but is **not** loaded by `popup.html` in v6.0.

---

## Language Detection

Implemented in `popup.js` as `detectLanguage()` / `setLanguageDirection()` (replaces legacy `filter()` hash heuristic).

```js
// Count Tamil codepoints (U+0B80–U+0BFF) vs ASCII
if (tamilCount > asciiCount * 0.3) → 'tamil'  // fromLang=ta, toLang=en
else → 'english'                              // fromLang=en, toLang=ta
```

`toLang` selects the Wiktionary subdomain (`en.wiktionary.org` vs `ta.wiktionary.org`). Tamil VU uses `key_sel=Tamil` or `key_sel=English` based on `currentLanguage`.

---

## Lookup: Wiktionary

- **Trigger**: Enter, Wiktionary button, auto on popup open with selection, in-result `#` link clicks
- **API**: MediaWiki `action=parse` (single fetch per lookup)

```
https://{toLang}.wiktionary.org/w/api.php
  ?action=parse
  &prop=text|revid|displaytitle
  &format=json
  &page={word}
  &origin=*
```

- **Processing** (`lookupWiktionary` → `renderWiktionaryResults`):
  - Injects parsed HTML into `#results`
  - Shows `fromLang → toLang` badge
  - Wires `#` anchor clicks to re-run lookup with link text
- **Notes**: v6 does not dual-fetch both language wikis in one request (unlike legacy `wikiRawParse()`). Simpler, one edition per detected direction.

---

## Lookup: Tamil VU Glossary

- **Trigger**: Tamil VU Glossary button
- **URL**:

```
https://www.tamilvu.org/slet/technical_glossary/tech_engser.jsp
  ?selsub=All&schsel=full&editor={word}&key_sel={Tamil|English}
```

- **Availability**: The glossary endpoint is sometimes **temporarily down or very slow** (not an extension bug). When it recovers, the same URL works in Brave and in Sorkalam.
- **Fetch path**: Popup sends `{ action: 'fetchTamilVUGlossary', searchWord, glossarySearchColumn }`. The service worker fetches **HTTPS only**, then a **hidden-tab fallback** if needed. Returns `{ ok, glossaryPageHtml, fromCache?, cacheKey }`. The popup parses HTML with `DOMParser` in [`tamilvu-glossary-parse.js`](tamilvu-glossary-parse.js) → `{ columns, rows }` JSON, then maps rows to display entries.
- **Cache** ([`glossary-cache.js`](glossary-cache.js)): **IndexedDB** (`sorkalam-glossary-cache`), shared by popup and service worker. Key: `tamilvu:{English|Tamil}:{word}`. Stores HTML (SW) and parsed `glossaryEntries` (popup). TTL **7 days**, max **250** entries; pruned on write and extension install/update.

```mermaid
sequenceDiagram
  participant Popup
  participant IDB as IndexedDB
  participant SW as event.js
  participant TVU as tamilvu.org

  Popup->>IDB: getTamilVu (parsed entries?)
  alt entries hit
    IDB-->>Popup: glossaryEntries
    Popup->>Popup: render (cached)
  else miss
    Popup->>SW: fetchTamilVUGlossary
    SW->>IDB: getTamilVu (HTML?)
    alt HTML hit
      IDB-->>SW: glossaryPageHtml
    else
      SW->>TVU: fetch
      SW->>IDB: setTamilVu (HTML)
    end
    SW-->>Popup: glossaryPageHtml
    Popup->>Popup: parse → entries
    Popup->>IDB: setTamilVu (HTML + table + entries)
  end
```

- **Processing** (`tamilvu-glossary-parse.js` in the popup; `event.js` only fetches HTML):
  - `DOMParser` → results table with header row (`English`, `Subject`, …) → **`{ columns, rows }`**
  - Each `row` is a plain object, e.g. `{ slNo, english, tamil, subject, volume }`
  - `glossaryTableToEntries()` picks **translationText** (Tamil when searching English) and **subjectArea** for the list UI; keeps full `row` on each entry for traversal
  - Renders ordered list with `{ subject }` suffix
- **Errors**: Network or HTTP failures return `{ ok: false, error }`; the popup shows a message in `#status`.

---

## Selected Text Capture

### `content.js`

- Maintains `lastSelection` so highlight is not lost when focus moves to the popup
- Listens: `mouseup`, `keyup`, `selectionchange`
- Responds to `{ action: 'getSelectedWord' }` with `{ selectedWord: string }`

### `event.js`

- Handles `{ action: 'getSelectedWordFromPage' }` from the popup
- `chrome.tabs.sendMessage` → content script
- On failure: `chrome.scripting.executeScript` with `activeTab` (user invoked the extension)

### Restrictions

Selection and content scripts do not run on `brave://`, `chrome://`, extension store pages, or some PDF/embed contexts.

---

## Removed vs Legacy (v5.x)

| Feature | Legacy ([TECH_DETAILS.md](TECH_DETAILS.md)) | v6.0 (this doc) |
|---------|---------------------------------------------|-----------------|
| Glosbe | Default lookup | Removed |
| Google Translate stub | Present | Removed |
| jQuery | Required | Not used in popup |
| MV2 background page | `getBackgroundPage()` | Service worker + messages |
| Dual Wiktionary fetch | Both `frm` and `des` wikis | Single `toLang` wiki |
| Pronunciation audio | English speaker icon | Not implemented |

---

## File Map

```
popup.js       detectLanguage, lookupWiktionary, lookupTamilVU, performLookup, initializePopup
glossary-cache.js        IndexedDB Tamil VU cache (HTML + parsed entries)
tamilvu-glossary-parse.js  DOMParser table → { columns, rows }; glossaryTableToEntries
content.js     lastCapturedSelection cache, getSelectedWord message handler
event.js       getSelectedWordFromPage relay, Tamil VU glossary fetch
manifest.json  MV3 config
popup.html     UI shell (no jQuery script tag)
```

---

## Development references

v6.0 follows MV3 patterns documented in [`.cursor/skills/sorkalam/`](.cursor/skills/sorkalam/) (lean, repo-specific). Broader Chrome extension and web UI guidance: **[GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance/tree/main)** (referenced by link, not copied in full).

---

## See also

| Document | Contents |
|----------|----------|
| [README.md](README.md) | Features, Brave developer install, usage, references |
| [TECH_DETAILS.md](TECH_DETAILS.md) | Legacy v5.5 — [tree/v5-legacy](https://github.com/p10ns11y/sorkalam-extension/tree/v5-legacy), [MV2 user notes](TECH_DETAILS.md#still-using-the-manifest-v2-v55-build) |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
