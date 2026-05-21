// Sorkalam - Modern Manifest V3 Version
// Following chrome-extensions skill + modern-web-guidance best practices

let currentLanguage = null;
let fromLang = null;
let toLang = null;

// Modern language detection (improved from original hash method)
function detectLanguage(text) {
  if (!text) return 'english';
  
  const cleanText = text.trim();
  if (!cleanText) return 'english';

  // Count Tamil Unicode characters (U+0B80–U+0BFF)
  let tamilCount = 0;
  let asciiCount = 0;

  for (const char of cleanText) {
    const code = char.charCodeAt(0);
    if (code >= 0x0B80 && code <= 0x0BFF) tamilCount++;
    else if (code < 128) asciiCount++;
  }

  if (tamilCount > asciiCount * 0.3) return 'tamil';
  return 'english';
}

// Set language direction
function setLanguageDirection(text) {
  const lang = detectLanguage(text);
  currentLanguage = lang;
  
  if (lang === 'tamil') {
    fromLang = 'ta';
    toLang = 'en';
  } else {
    fromLang = 'en';
    toLang = 'ta';
  }
  
  return lang;
}

// Modern fetch helper with proper error handling
async function fetchJSON(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

// Wiktionary lookup (modern async version)
async function lookupWiktionary(word) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = 'Searching Wiktionary...';
  
  try {
    const url = `https://${toLang}.wiktionary.org/w/api.php?action=parse&prop=text|revid|displaytitle&format=json&page=${encodeURIComponent(word)}&origin=*`;
    
    const data = await fetchJSON(url);
    
    if (data.parse && data.parse.text && data.parse.text['*']) {
      renderWiktionaryResults(data.parse.text['*'], word);
      statusEl.textContent = '';
    } else {
      statusEl.textContent = 'No results found on Wiktionary';
    }
  } catch (error) {
    statusEl.textContent = 'Wiktionary lookup failed. Please try again.';
    console.error(error);
  }
}

// Tamil VU Glossary lookup
async function lookupTamilVU(word) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = 'Searching Tamil VU Glossary...';
  
  try {
    const keySel = currentLanguage === 'tamil' ? 'Tamil' : 'English';
    // https://www.tamilvu.org/slet/technical_glossary/tech_engser.jsp?selsub=All&schsel=full&editor=texture&key_sel=English
    const url = `https://www.tamilvu.org/slet/technical_glossary/tech_engser.jsp?selsub=All&schsel=full&editor${encodeURIComponent(word)}&key_sel=${keySel}`;
    
    // Note: Direct fetch may be blocked by CORS in some cases.
    // In production, consider a lightweight proxy or use chrome.runtime.sendMessage to background.
    const response = await fetch(url);
    const html = await response.text();
    
    renderTamilVUResults(html, word);
    statusEl.textContent = '';
  } catch (error) {
    statusEl.textContent = 'Tamil VU lookup failed (CORS or network issue)';
    console.error(error);
  }
}

// Render Wiktionary results (cleaned)
function renderWiktionaryResults(htmlContent, word) {
  const resultsEl = document.getElementById('results');
  resultsEl.style.display = 'block';
  resultsEl.innerHTML = `
    <div class="result-header">
      <span class="language-badge">${fromLang.toUpperCase()} → ${toLang.toUpperCase()}</span>
      <strong>${word}</strong>
    </div>
    <div class="result-content">
      ${htmlContent}
    </div>
  `;
  
  // Make internal links clickable for recursive search
  resultsEl.querySelectorAll('a').forEach(link => {
    if (link.getAttribute('href')?.startsWith('#')) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const newWord = link.textContent.trim();
        if (newWord) {
          document.getElementById('word').value = newWord;
          lookupWiktionary(newWord);
        }
      });
    }
  });
}

// Render Tamil VU results
// Tamil VU Glossary Renderer v7.2 (Smart cell detection)
function renderTamilVUResults(html, word) {
  const resultsEl = document.getElementById('results');
  resultsEl.style.display = 'block';

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rows = doc.querySelectorAll('tr');

  let output = `
    <div class="result-header">
      <strong>${word}</strong> — Tamil VU Glossary
    </div>
    <ol style="padding-left:18px; margin:6px 0 0 0; line-height:1.4;">
  `;

  let found = 0;

  rows.forEach(row => {
    const tds = row.querySelectorAll('td');
    if (tds.length < 3) return;

    const cellTexts = Array.from(tds).map(td => 
      td.textContent.trim().replace(/\s+/g, ' ')
    );

    // === Term: prefer Tamil text (like v7.3), fallback to old column logic ===
    let term = '';
    const hasTamil = cellTexts.some(t => /[\u0B80-\u0BFF]/.test(t));
    
    if (hasTamil) {
      // Find the cell with Tamil
      term = cellTexts.find(t => /[\u0B80-\u0BFF]/.test(t)) || '';
    } else {
      // Fallback to old logic (column 3 or 4)
      term = cellTexts[3] || cellTexts[4] || cellTexts[2] || '';
    }

    // === Subject: use column 2 (exactly like your old working code) ===
    let subject = cellTexts[2] || cellTexts[1] || '';
    // Clean volume number if present
    subject = subject.replace(/Volume\s*-\s*\d+/i, '').trim() || subject;

    // Final cleanup
    term = term.replace(/<[^>]*>/g, '').trim();

    if (term && term.length > 2 && term !== subject) {
      output += `
        <li style="margin-bottom: 6px;">
          ${term} 
          <span style="color:#666; font-size:0.82em;">{ ${subject} }</span>
        </li>
      `;
      found++;
    }
  });

  if (found === 0) {
    output += `<li style="color:#c00;">No results parsed. Please check console.</li>`;
  }

  output += `</ol>`;
  resultsEl.innerHTML = output;
}

// Main lookup handler
async function performLookup(source) {
  const input = document.getElementById('word').value.trim();
  if (!input) return;

  setLanguageDirection(input);
  document.getElementById('results').style.display = 'none';

  if (source === 'wiki') {
    await lookupWiktionary(input);
  } else if (source === 'tvu') {
    await lookupTamilVU(input);
  }
}

// Initialize modern popup
function initializePopup() {
  const wordInput = document.getElementById('word');
  const wikiBtn = document.getElementById('wiki-btn');
  const tvuBtn = document.getElementById('tvu-btn');

  // Auto-focus
  wordInput.focus();

  // Enter key support (modern-web-guidance form patterns)
  wordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      performLookup('wiki'); // Default to Wiktionary on Enter
    }
  });

  // Button handlers
  wikiBtn.addEventListener('click', () => performLookup('wiki'));
  tvuBtn.addEventListener('click', () => performLookup('tvu'));

  // Auto-lookup selected text (MV3 compliant using async/await)
  chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
    if (!tab?.id) return;
    
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection().toString()
      });
      
      const selectedText = result?.result?.trim();
      if (selectedText) {
        wordInput.value = selectedText;
        setLanguageDirection(selectedText);
        // Auto-trigger Wiktionary
        performLookup('wiki');
      }
    } catch (err) {
      console.log('Could not get selected text:', err);
    }
  });

  // Show helpful tip
  console.log('%c[Sorkalam] Modern MV3 version initialized', 'color:#0a66c2');
}

// Boot the extension
document.addEventListener('DOMContentLoaded', initializePopup);
