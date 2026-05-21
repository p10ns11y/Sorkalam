# Sorkalam (சொற்களம்) — Technical Details (Legacy v5.x)

> **This document describes the original extension (Manifest V2, jQuery, Glosbe + multi-source lookups).**  
> For the current **v6.0 Manifest V3** implementation, see **[TECH_DETAILS_V6.md](TECH_DETAILS_V6.md)**.  
> User-facing overview: **[README.md](README.md)**.

Sorkalam is a lightweight Chrome extension (originally Manifest V2) for quick Tamil ↔ English word/phrase lookups across multiple dictionary and glossary sources. It was designed for Tamil speakers, students, and technical translators.

## Core Architecture

- **Popup-driven**: All UI and logic lives in `popup.html` + `popup.js` (jQuery-based).
- **Language detection**: Heuristic in `filter()` using Unicode codepoint sums to distinguish Tamil vs English text.
- **Result handling**: Centralized `result(data)` function that dispatches based on global flags (`glosbe`, `wiki`, `tvu`, `google`).
- **Background + Content scripts** (`event.js`, `content.js`): Used only to capture currently selected text when the popup opens.

## Lookup Implementations

### 1. Glosbe (Default / Smart Lookup)
- **Trigger**: Enter key, auto on selection, or explicit Glosbe button.
- **API**: Glosbe public translate API via JSONP.
  - Endpoint: `https://glosbe.com/gapi/translate?from={from}&dest={dest}&format=json&phrase={word}&callback=result`
- **Language direction**: Auto-swapped based on detected language (`ta` ↔ `eng`).
- **Data processing** (`result()` when `glosbe === 1`):
  - Iterates `data.tuc[]` array.
  - Collects `phrase.text` and `meanings[].text` for both source and target languages.
  - Renders as `<ul>` lists.
- **Notes**: Most reliable free bilingual dictionary source at the time. Returns both direct translations and example meanings.

### 2. Wiktionary
- **Trigger**: Wiki button or clicking links inside previous Wiktionary results.
- **API**: MediaWiki `action=parse` (two parallel XHR calls).
  - Primary: `https://{des}.wiktionary.org/w/api.php?action=parse&prop=text|revid|displaytitle&format=json&page={word}`
  - Secondary: Same on the opposite language wiki (`{frm}.wiktionary.org`).
- **Processing** (`wikiRawParse()`):
  - Fetches raw HTML from both language editions.
  - Strips inline styles, widths, and rewrites external links to internal `#` anchors.
  - Extracts ordered (`<ol>`) and unordered (`<ul>`) lists.
  - Special handling: hides nested `ul` inside `ol` for cleaner Tamil results.
- **Hyperlink support**: Clicking any result link triggers another `wikiRawParse()` (recursive quick lookup).
- **Notes**: Good for etymology, usage notes, and technical terms. Works bidirectionally.

### 3. Tamil VU Glossary (tamilvu.org)
- **Trigger**: TVU button.
- **Method**: Direct scrape of the technical glossary search form.
  - Base URL: `http://www.tamilvu.org/slet/technical_glossary/tech_engser.jsp?...`
  - Dynamically appends `&key_sel=Tamil` or `&key_sel=English` depending on detected language.
- **Processing** (`tvuGlosSearch()` + `result()` when `tvu === 1`):
  - Parses the returned HTML table (`<tr>` elements).
  - Extracts term (column 3 or 4) + subject/category (column 2).
  - Renders as `<ol><li>term <i>{subject}</i></li>`.
- **Notes**: Focused on technical / academic terminology used by Tamil Virtual Academy. Best for domain-specific vocabulary (science, law, etc.).

### 4. Google
- **Current state**: Disabled / stub.
- **Original intent**: Google Translate API (no longer free).
- **Fallback behavior**: Constructs deep links to:
  - `https://www.google.com/search?q=...`
  - Google Translate search URLs (`translate+english+to+tamil+...`)
- **Notes**: Left in place for historical reasons and as a reminder of API economics.

## Language Detection (`filter()`)

```js
// Simplified logic
hashAdd = sum of charCodeAt(i) for each character
if (hashAdd is in Tamil Unicode range) → language = "tamil"
else if (hashAdd is in ASCII range)    → language = "english"
else                                   → language = "mixed"
```

- Strips special characters and normalizes whitespace.
- Sets global `frm`/`des` and `from`/`dest` variables used by all lookup functions.
- Controls visibility of pronunciation speaker icon (only for English).

## Data Flow Summary

1. User types or selects text → `filter()` detects language and cleans input.
2. Lookup function called (`glosbeLookup`, `wikiRawParse`, `tvuGlosSearch`, etc.).
3. Sets a global flag (`glosbe = 1`, `wiki = 1`, …) and `newURL`.
4. AJAX / XHR completes → `result(data)` is invoked.
5. `result()` checks flags, renders appropriate HTML into `#results` and `#newtab`.
6. Flags reset after rendering.

## Historical / Technical Notes

- Originally built with jQuery 1.10.2 and Manifest V2 patterns (`browser_action`, persistent background page).
- Heavy use of global variables for state (common in small legacy extensions).
- Content Security Policy was relaxed to allow calls to the four external dictionary domains.
- Pronunciation audio only implemented for English via Google’s static dictionary sound files.

This document serves as an archival reference for the lookup strategies and data parsing techniques used in the **legacy** extension.

---

## See also

| Document | Contents |
|----------|----------|
| [README.md](README.md) | Features, Brave install, usage |
| [TECH_DETAILS_V6.md](TECH_DETAILS_V6.md) | v6.0 MV3 architecture, Wiktionary + Tamil VU, selection capture |
| [CHANGELOG.md](CHANGELOG.md) | Version history |