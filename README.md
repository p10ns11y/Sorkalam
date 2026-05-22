# Sorkalam (சொற்களம்)

**Tamil ↔ English lookup in your browser toolbar** — two glossaries for focused study, two research helpers when you want to go deeper.

<p align="center">
  <img src="images/sorkalam-logo-retro.png" alt="சொற்களம் — Sorkalam" width="128" height="128">
</p>

### What Sorkalam offers

**Focus helpers (glossaries)** — results stay in the popup:

| | Source | Role |
|---|--------|------|
| **W** | [Wiktionary](https://www.wiktionary.org/) | Dictionary / thesaurus (Tamil ↔ English) |
| **TVU** | [Tamil Virtual University](https://www.tamilvu.org/) | Technical glossary (cached in the extension) |

**Research helpers** — open in a new tab:

| | Source | Role |
|---|--------|------|
| **G** | [Grok](https://grok.com/) | Take the conversation externally |
| **GP** | [Grokipedia](https://grokipedia.com/) | Broader, popular-articles lookup |

Type or highlight a word, then tap a chip — or press **Enter** for Wiktionary.

*v6.0 dev build — load unpacked in [Brave](https://brave.com/) or Chrome. Not on the Web Store yet. Still on the old MV2 listing? See [TECH_DETAILS.md — MV2 / v5.5](TECH_DETAILS.md#still-using-the-manifest-v2-v55-build).*

---

## Quick start

| Step | Action |
|------|--------|
| 1 | Click the Sorkalam icon in the toolbar |
| 2 | Type Tamil or English; press **Enter** → Wiktionary |
| 3 | Or tap a provider chip (table below) |
| 4 | **Pro tip:** select text on a page, then open the popup — it auto-fills and runs Wiktionary |

Click words inside Wiktionary results for a quick follow-up lookup.

![Sorkalam popup — Tamil VU glossary results for “களம்”](images/sorkalam-popup-usage.png)

---

## Install (Developer Mode)

1. Clone or download this repo — you need the folder that contains `manifest.json`.
   ```bash
   git clone https://github.com/p10ns11y/sorkalam-extension.git
   cd sorkalam-extension
   ```
2. Open **`brave://extensions`** (or your browser’s extensions page — see table below).
3. Turn on **Developer mode** (top-right).

   ![Brave extensions — Developer mode on](images/brave-extensions-developer-mode.png)

4. Click **Load unpacked** and select the project root (not a subfolder like `css/`).
5. Pin **Sorkalam** from the extensions menu (puzzle icon).
6. After code edits, click **Reload** on the extension card at `brave://extensions`.

| Browser | Extensions URL |
|---------|------------------|
| Brave | `brave://extensions` |
| Chrome | `chrome://extensions` |
| Edge | `edge://extensions` |
| Chromium | `chrome://extensions` |

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| **Load unpacked** greyed out | Enable **Developer mode** first |
| Extension fails to load | Select the folder that contains `manifest.json`; read the error on the card |
| Selected text not detected | Reload extension, refresh the page, select text **before** opening the popup |
| Lookup fails on some sites | `brave://`, Web Store, and some PDFs block scripts — try a normal web page |
| Changes not visible | **Reload** the extension after saving files |

Tamil VU cache and parsing: [TECH_DETAILS_V6.md — Tamil VU Glossary](TECH_DETAILS_V6.md#lookup-tamil-vu-glossary).

---

## For developers

| Document | Contents |
|----------|----------|
| **[TECH_DETAILS_V6.md](TECH_DETAILS_V6.md)** | MV3 architecture, provider chips, selection flow, Tamil VU cache diagram, file map |
| **[CHANGELOG.md](CHANGELOG.md)** | v6.0 release notes |
| **[TECH_DETAILS.md](TECH_DETAILS.md)** | Legacy MV2 / v5.x |
| **[`.cursor/skills/sorkalam/`](.cursor/skills/sorkalam/)** | Optional Cursor/agent snippets (message passing, service worker, content scripts) |

Chrome extension patterns: [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance).

---

## License

GPL-2.0 — **பெரமு (Peramanathan Sathyamoorthy)**. Original concept (2014); adaptation (2026).

**வாழ்க தமிழ்! வாழ்க நற்றமிழர்!** 🇮🇳
