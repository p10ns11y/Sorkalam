# SORKALAM (சொற்களம்)

**Tamil ↔ English Dictionary & Technical Glossary** — Modern Manifest V3 Edition

> **Note**: This is a **developer/modernized version (v6.0)** primarily intended for **local testing in Chrome Developer Mode**. It is **not currently optimized for Chrome Web Store publication** (though it can be published later with minor changes).

---

## Features

- 🔍 **Wiktionary** lookup (English ↔ Tamil)
- 📚 **Tamil Virtual University (Tamilvu.org)** technical glossary
- 🧠 Smart language detection (Tamil ↔ English)
- ⚡ Auto-lookup of selected text when opening the extension
- 🔗 Clickable results for quick follow-up searches
- 🎨 Modern, lightweight UI (no jQuery)

---

## Installation (Developer Mode)

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **"Load unpacked"**
5. Select the folder containing `manifest.json`
6. Pin the extension to your toolbar for easy access

---

## Usage

1. Click the Sorkalam icon
2. Type a word (Tamil or English) and press **Enter** (defaults to Wiktionary)
3. Or click **Wiktionary** / **Tamil VU Glossary** buttons
4. Click any word in the results to perform a quick follow-up search

**Pro Tip**: Select any word on a webpage → Open the extension → It will automatically look it up!

---

## Tech Stack (v6.0)

- **Manifest V3**
- Vanilla JavaScript (no frameworks)
- Modern `fetch` + `async/await`
- Wiktionary API + Tamilvu.org

---

## Project Structure

```
sorkalam-modern/
├── manifest.json          # MV3 configuration
├── popup.html             # Main popup UI
├── popup.js               # Core logic (modern vanilla JS)
├── event.js               # Service worker
├── content.js             # Selected text capture
├── css/
│   └── popup.css          # Modern styling
├── icon.png
├── logo-150-50.png
├── CHANGELOG.md
└── README.md
```

---

## Development Notes

This version was modernized using:
- **chrome-extensions** skill best practices
- **modern-web-guidance** patterns

**Goals of v6.0**:
- Remove legacy dependencies (jQuery)
- Follow current Chrome extension standards
- Make the code maintainable and future-proof
- Keep the original soul and functionality intact

---

## License

GPL-2.0

---

## Author

**பெரமு (Peramanathan Sathyamoorthy)**  
Original concept & development — Modernization in 2026

---

**வாழ்க தமிழ்! வாழ்க நற்றமிழர்!** 🇮🇳

---

*This project is currently maintained for personal/developer use. Chrome Web Store publication may be considered in the future.*