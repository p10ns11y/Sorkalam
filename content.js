// Send the selected text/word as a message containing the page details back to the event page
chrome.runtime.sendMessage({
    'word': window.getSelection().toString()
});