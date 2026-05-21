// Sorkalam - Modern Service Worker (Manifest V3)
// Following chrome-extensions skill best practices

// Minimal background service worker
// Handles any future message passing if needed

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Sorkalam] Extension installed/updated (v6.0 - Modern MV3)');
});

// Optional: Add side panel support later if desired
// chrome.action.onClicked.addListener(async (tab) => {
//   await chrome.sidePanel.open({ windowId: tab.windowId });
// });