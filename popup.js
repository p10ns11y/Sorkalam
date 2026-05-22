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

function setStatus(message, tone = '') {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = 'status-line';
  if (tone) statusEl.classList.add(tone);
}

function clearResultsMeta() {
  const metaEl = document.getElementById('results-meta');
  if (metaEl) metaEl.innerHTML = '';
}

function renderResultsMeta(html) {
  const metaEl = document.getElementById('results-meta');
  if (metaEl) metaEl.innerHTML = html;
}

// Wiktionary lookup (modern async version)
async function lookupWiktionary(word) {
  setStatus('Searching Wiktionary…', 'is-busy');
  
  try {
    const url = `https://${toLang}.wiktionary.org/w/api.php?action=parse&prop=text|revid|displaytitle&format=json&page=${encodeURIComponent(word)}&origin=*`;
    
    const data = await fetchJSON(url);
    
    if (data.parse && data.parse.text && data.parse.text['*']) {
      renderWiktionaryResults(data.parse.text['*'], word);
      setStatus('');
    } else {
      renderResultsMessage('No results found on Wiktionary.');
      setStatus('');
    }
  } catch (error) {
    renderResultsMessage('Wiktionary lookup failed. Please try again.', true);
    setStatus('', 'is-error');
    console.error(error);
  }
}

// Tamil VU technical glossary lookup
async function lookupTamilVUGlossary(searchWord) {
  setStatus('Searching Tamil VU Glossary…', 'is-busy');

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
        setStatus('');
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
    setStatus('');
  } catch (lookupError) {
    renderResultsMessage(lookupError.message, true);
    setStatus('');
    console.error(lookupError);
  }
}

// Render Wiktionary results (cleaned)
function renderResultsMessage(message, isError = false) {
  clearResultsMeta();
  const resultsEl = document.getElementById('results');
  resultsEl.innerHTML = `
    <p class="result-message${isError ? ' result-message--error' : ''}">${escapeHtml(message)}</p>
  `;
}

function renderWiktionaryResults(htmlContent, word) {
  const resultsEl = document.getElementById('results');
  resultsEl.innerHTML = `
    <div class="result-scroll result-content">
      ${htmlContent}
    </div>
  `;
  renderResultsMeta(`
    <strong class="meta-query">${escapeHtml(word)}</strong>
    <span class="language-badge">${fromLang} → ${toLang}</span>
    <span class="result-source">Wiktionary</span>
  `);
  
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
  const glossarySearchColumn =
    currentLanguage === 'tamil' ? 'Tamil' : 'English';

  const cacheBadge = fromCache
    ? '<span class="cache-badge">Cached</span>'
    : '';

  let listHtml = '';

  if (!glossaryEntries?.length) {
    listHtml =
      '<li class="glossary-item glossary-item--empty">No glossary entries found.</li>';
  } else {
    for (const glossaryEntry of glossaryEntries) {
      const translationText = resolveTamilVuTranslationText(
        glossaryEntry,
        glossarySearchColumn
      );
      const subject = glossaryEntry.subjectArea
        ? `<span class="glossary-subject">${escapeHtml(glossaryEntry.subjectArea)}</span>`
        : '';
      const termHtml = formatGlossaryTermHtml(translationText);
      listHtml += `
        <li class="glossary-item">
          <span class="glossary-term">${termHtml}</span>
          ${subject}
        </li>
      `;
    }
  }

  resultsEl.innerHTML = `
    <div class="result-scroll">
      <ol class="glossary-list">${listHtml}</ol>
    </div>
  `;
  renderResultsMeta(`
    <strong class="meta-query">${escapeHtml(searchWord)}</strong>
    <span class="result-source">Tamil VU Glossary</span>
    ${cacheBadge}
  `);
}

/** Supports v4 entries; falls back if older cache rows stored english/tamil. */
function resolveTamilVuTranslationText(glossaryEntry, glossarySearchColumn) {
  if (glossaryEntry.translationText) return glossaryEntry.translationText;
  const { english = '', tamil = '' } = glossaryEntry;
  if (glossarySearchColumn === 'Tamil') return english || tamil;
  return tamil || english;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Wrap Tamil translation text for font selection and screen readers. */
function formatGlossaryTermHtml(translationText) {
  const safe = escapeHtml(translationText);
  if (currentLanguage === 'english') {
    return `<span lang="ta">${safe}</span>`;
  }
  if (currentLanguage === 'tamil') {
    return `<span lang="en">${safe}</span>`;
  }
  return safe;
}

// Main lookup handler
async function performLookup(lookupProvider) {
  const wordInput = document.getElementById('word');
  const searchWord = normalizeInput(wordInput.value);
  if (!searchWord) return;

  wordInput.value = searchWord;
  setLanguageDirection(searchWord);
  clearResultsMeta();

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
  const lookupForm = document.querySelector('.lookup-form');

  lookupForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    performLookup('wiki');
  });

  // Auto-focus
  wordInput.focus();

  // Enter in search field (form submit also triggers wiki lookup)
  wordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performLookup('wiki');
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
