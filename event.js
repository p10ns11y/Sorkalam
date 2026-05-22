// Sorkalam - Service Worker (Manifest V3)
// Relays selected text and fetches Tamil VU (host_permissions bypass popup CORS)

const TAMIL_VU_FETCH_HEADERS = {
  Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,ta;q=0.8',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Sorkalam] Extension installed/updated (v6.0 - Modern MV3)');
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'fetchTamilVUGlossary') {
    (async () => {
      try {
        sendResponse(
          await fetchTamilVUGlossary(
            message.searchWord,
            message.glossarySearchColumn
          )
        );
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }
  if (message.action === 'getSelectedWordFromPage') {
    (async () => {
      try {
        sendResponse(await getSelectedWordFromActiveTab());
      } catch (err) {
        console.log('[Sorkalam] getSelectedWordFromPage failed:', err);
        sendResponse({ selectedWord: '' });
      }
    })();
    return true;
  }
});

function buildTamilVUGlossarySearchUrl(searchWord, glossarySearchColumn) {
  const query = new URLSearchParams({
    selsub: 'All',
    schsel: 'full',
    editor: searchWord,
    key_sel: glossarySearchColumn,
  });
  return `https://www.tamilvu.org/slet/technical_glossary/tech_engser.jsp?${query}`;
}

async function fetchGlossaryPageHtml(glossarySearchUrl, timeoutMs) {
  const abortController = new AbortController();
  const abortTimerId = setTimeout(() => abortController.abort(), timeoutMs);
  const tamilVuOrigin = new URL(glossarySearchUrl).origin;
  try {
    const httpResponse = await fetch(glossarySearchUrl, {
      signal: abortController.signal,
      headers: {
        ...TAMIL_VU_FETCH_HEADERS,
        Referer: `${tamilVuOrigin}/slet/technical_glossary/`,
      },
      redirect: 'follow',
      cache: 'no-store',
    });
    if (!httpResponse.ok) throw new Error(`HTTP ${httpResponse.status}`);
    return await httpResponse.text();
  } finally {
    clearTimeout(abortTimerId);
  }
}

async function fetchTamilVUGlossaryPageViaHiddenTab(glossarySearchUrl, timeoutMs) {
  const glossaryTab = await chrome.tabs.create({ url: glossarySearchUrl, active: false });

  return new Promise((resolve, reject) => {
    let hasSettled = false;

    const settle = (loadError, glossaryPageHtml) => {
      if (hasSettled) return;
      hasSettled = true;
      clearTimeout(loadTimeoutId);
      chrome.tabs.onUpdated.removeListener(onGlossaryTabUpdated);
      chrome.tabs.remove(glossaryTab.id).catch(() => {});
      if (loadError) reject(loadError);
      else resolve(glossaryPageHtml);
    };

    const loadTimeoutId = setTimeout(() => {
      settle(new Error('Glossary page load timed out'));
    }, timeoutMs);

    const onGlossaryTabUpdated = (updatedTabId, changeInfo) => {
      if (updatedTabId !== glossaryTab.id || changeInfo.status !== 'complete') return;

      chrome.scripting
        .executeScript({
          target: { tabId: glossaryTab.id },
          func: () => document.documentElement.outerHTML,
        })
        .then((scriptResults) => {
          const glossaryPageHtml = scriptResults?.[0]?.result;
          if (!glossaryPageHtml || glossaryPageHtml.length < 100) {
            settle(new Error('Tamil VU returned an empty glossary page'));
            return;
          }
          settle(null, glossaryPageHtml);
        })
        .catch((scriptError) => settle(scriptError));
    };

    chrome.tabs.onUpdated.addListener(onGlossaryTabUpdated);
  });
}

async function fetchTamilVUGlossary(searchWord, glossarySearchColumn) {
  const glossarySearchUrl = buildTamilVUGlossarySearchUrl(
    searchWord,
    glossarySearchColumn
  );
  const failureReasons = [];

  try {
    const glossaryPageHtml = await fetchGlossaryPageHtml(glossarySearchUrl, 35000);
    if (glossaryPageHtml?.length > 100) {
      return { ok: true, glossaryPageHtml };
    }
    failureReasons.push('fetch returned empty glossary page');
  } catch (fetchError) {
    const reason =
      fetchError.name === 'AbortError' ? 'fetch timed out' : fetchError.message;
    failureReasons.push(reason);
    console.warn('[Sorkalam] Tamil VU fetch:', reason);
  }

  try {
    const glossaryPageHtml = await fetchTamilVUGlossaryPageViaHiddenTab(
      glossarySearchUrl,
      45000
    );
    if (glossaryPageHtml?.length > 100) {
      return { ok: true, glossaryPageHtml };
    }
    failureReasons.push('hidden tab returned empty glossary page');
  } catch (tabFallbackError) {
    failureReasons.push(`hidden tab: ${tabFallbackError.message}`);
    console.warn('[Sorkalam] Tamil VU tab fallback:', tabFallbackError);
  }

  return {
    ok: false,
    error: `Tamil VU may be temporarily down — retry later. (${failureReasons.join('; ')})`,
    glossarySearchUrl,
  };
}

async function getSelectedWordFromActiveTab() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) return { selectedWord: '' };

  try {
    const contentScriptReply = await chrome.tabs.sendMessage(activeTab.id, {
      action: 'getSelectedWord',
    });
    return { selectedWord: contentScriptReply?.selectedWord || '' };
  } catch {
    // Content script may not be ready — fall back to executeScript
  }

  try {
    const [selectionScriptResult] = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => window.getSelection().toString().trim(),
    });
    return { selectedWord: selectionScriptResult?.result || '' };
  } catch (selectionError) {
    console.log('[Sorkalam] Could not read selection:', selectionError);
    return { selectedWord: '' };
  }
}
