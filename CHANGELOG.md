# Changelog

All notable changes to Sorkalam will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [6.0.0] - 2026-05-21

### 🚀 Major Modernization

This release completely modernizes Sorkalam for 2026 standards while keeping the original spirit and functionality.

#### Changed
- **Manifest V3** — Full compliance with current Chrome extension standards
- **Removed jQuery 1.10.2** entirely — Replaced with modern vanilla JavaScript + `fetch` API
- **Architecture overhaul** — Cleaner code structure, reduced global state, better separation of concerns
- **Language detection** — Improved Unicode-based detection (more reliable)
- **UI/UX** — Modern system fonts, cleaner layout, better accessibility, smooth interactions
- **Error handling** — Proper try/catch with user-friendly status messages
- **Async patterns** — All API calls now use `async/await` (no more promise chains)

#### Added
- Modern CSS with CSS custom properties
- Better visual feedback during lookups
- Improved auto-lookup of selected text on popup open
- Clickable result links for recursive Wiktionary searches (preserved from original)
- Clearer status messages

#### Removed
- jQuery dependency (major size and performance win)
- Legacy global variable patterns
- Old `.then()` promise chains

#### Technical
- Follows **chrome-extensions** skill best practices (18+ mandatory rules)
- Incorporates **modern-web-guidance** patterns for frontend code
- Scoped `host_permissions` to only required domains
- Cleaner `manifest.json` with proper MV3 structure

---

## [5.5.0] - Previous Version (Legacy)

- Original Manifest V2 → V3 migration
- Wiktionary + Tamil VU Glossary support
- Glosbe and Google (disabled) integrations
- jQuery-based implementation

---

**Note**: Version 6.0.0 is primarily intended for **local developer testing** in Chrome's developer mode. It is **not yet optimized for Chrome Web Store publication** (though it can be published later with minor adjustments).