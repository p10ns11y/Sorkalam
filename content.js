// Sorkalam - Content Script (Manifest V3)
// Captures page text selection for the popup (selection is often cleared when popup opens)

let lastCapturedSelection = '';

function rememberPageSelection() {
  const liveSelection = window.getSelection().toString().trim();
  if (liveSelection) lastCapturedSelection = liveSelection;
}

function getSelectedWordFromPage() {
  const liveSelection = window.getSelection().toString().trim();
  return liveSelection || lastCapturedSelection;
}

document.addEventListener('mouseup', rememberPageSelection);
document.addEventListener('keyup', rememberPageSelection);
document.addEventListener('selectionchange', rememberPageSelection);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'getSelectedWord') {
    sendResponse({ selectedWord: getSelectedWordFromPage() });
  }
});
