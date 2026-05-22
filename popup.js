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

/** Trim; lowercase English/Latin input (Tamil VU expects e.g. editor=texture). */
function normalizeInput(text) {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (detectLanguage(trimmed) === 'english') {
    return trimmed.toLowerCase();
  }
  return trimmed;
}

// Ask the service worker (Promise API; callback form can hang if sendResponse is late)
async function sendMessageAsync(message, timeoutMs = 30000) {
  const responsePromise = chrome.runtime.sendMessage(message);
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timed out')), timeoutMs);
  });

  const response = await Promise.race([responsePromise, timeoutPromise]);

  if (response === undefined) {
    throw new Error(
      'No response from background. Reload the extension at brave://extensions.'
    );
  }
  return response;
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

// Tamil VU technical glossary lookup
async function lookupTamilVUGlossary(searchWord) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = 'Searching Tamil VU Glossary...';

  try {
    const glossarySearchColumn =
      currentLanguage === 'tamil' ? 'Tamil' : 'English';
    const cacheKey = GlossaryCache.buildTamilVuCacheKey(
      searchWord,
      glossarySearchColumn
    );

    try {
      const cachedRecord = await GlossaryCache.getTamilVu(cacheKey);
      if (cachedRecord?.glossaryEntries?.length) {
        renderTamilVUGlossary(cachedRecord.glossaryEntries, searchWord, true);
        statusEl.textContent = '';
        return;
      }
    } catch (cacheReadError) {
      console.warn('[Sorkalam] Tamil VU parsed cache read:', cacheReadError);
    }

    const glossaryResponse = await sendMessageAsync(
      {
        action: 'fetchTamilVUGlossary',
        searchWord,
        glossarySearchColumn,
      },
      90000
    );
    if (!glossaryResponse?.ok) {
      const lookupError = new Error(glossaryResponse?.error || 'Glossary fetch failed');
      lookupError.glossarySearchUrl = glossaryResponse?.glossarySearchUrl;
      throw lookupError;
    }

    let glossaryEntries = glossaryResponse.glossaryEntries;
    let glossaryTable = null;
    if (!glossaryEntries?.length) {
      if (!glossaryResponse.glossaryPageHtml) {
        throw new Error(
          'No glossary HTML received. Reload the extension at brave://extensions.'
        );
      }
      glossaryTable = TamilVUGlossaryParse.parseTamilVUGlossaryHtml(
        glossaryResponse.glossaryPageHtml
      );
      glossaryEntries = TamilVUGlossaryParse.glossaryTableToEntries(
        glossaryTable,
        glossarySearchColumn
      );
    }
    if (!glossaryEntries.length) {
      throw new Error('No glossary entries found in results table.');
    }

    const responseCacheKey = glossaryResponse.cacheKey || cacheKey;
    try {
      await GlossaryCache.setTamilVu({
        cacheKey: responseCacheKey,
        glossaryPageHtml: glossaryResponse.glossaryPageHtml,
        glossaryTable,
        glossaryEntries,
      });
    } catch (cacheWriteError) {
      console.warn('[Sorkalam] Tamil VU parsed cache write:', cacheWriteError);
    }

    renderTamilVUGlossary(
      glossaryEntries,
      searchWord,
      Boolean(glossaryResponse.fromCache)
    );
    statusEl.textContent = '';
  } catch (lookupError) {
    statusEl.textContent = lookupError.message;
    console.error(lookupError);
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
          const normalized = normalizeInput(newWord);
          document.getElementById('word').value = normalized;
          lookupWiktionary(normalized);
        }
      });
    }
  });
}

// Render Tamil VU glossary rows (parsed in service worker)
function renderTamilVUGlossary(glossaryEntries, searchWord, fromCache = false) {
  const resultsEl = document.getElementById('results');
  resultsEl.style.display = 'block';

  const cacheLabel = fromCache
    ? ' <span style="color:#888; font-weight:normal; font-size:0.85em;">(cached)</span>'
    : '';

  let resultsHtml = `
    <div class="result-header">
      <strong>${escapeHtml(searchWord)}</strong> — Tamil VU Glossary${cacheLabel}
    </div>
    <ol style="padding-left:18px; margin:6px 0 0 0; line-height:1.4;">
  `;

  if (!glossaryEntries?.length) {
    resultsHtml += `<li style="color:#c00;">No glossary entries found.</li>`;
  } else {
    for (const glossaryEntry of glossaryEntries) {
      const { translationText, subjectArea } = glossaryEntry;
      resultsHtml += `
        <li style="margin-bottom: 6px;">
          ${escapeHtml(translationText)}
          <span style="color:#666; font-size:0.82em;">{ ${escapeHtml(subjectArea)} }</span>
        </li>
      `;
    }
  }

  resultsHtml += `</ol>`;
  resultsEl.innerHTML = resultsHtml;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Main lookup handler
async function performLookup(lookupProvider) {
  const wordInput = document.getElementById('word');
  const searchWord = normalizeInput(wordInput.value);
  if (!searchWord) return;

  wordInput.value = searchWord;
  setLanguageDirection(searchWord);
  document.getElementById('results').style.display = 'none';

  if (lookupProvider === 'wiki') {
    await lookupWiktionary(searchWord);
  } else if (lookupProvider === 'tvu') {
    await lookupTamilVUGlossary(searchWord);
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

  // Auto-lookup selected text via content script (works on all_urls pages)
  sendMessageAsync({ action: 'getSelectedWordFromPage' })
    .then((selectionResponse) => {
      const selectedWord = normalizeInput(selectionResponse?.selectedWord || '');
      if (selectedWord) {
        wordInput.value = selectedWord;
        setLanguageDirection(selectedWord);
        performLookup('wiki');
      }
    })
    .catch((selectionError) =>
      console.log('Could not get selected word:', selectionError)
    );

  // Show helpful tip
  console.log('%c[Sorkalam] Modern MV3 version initialized', 'color:#0a66c2');
}

// Boot the extension
document.addEventListener('DOMContentLoaded', initializePopup);
