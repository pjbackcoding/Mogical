// Initialize default replacements if none exist
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['replacements'], function(result) {
    if (!result.replacements) {
      chrome.storage.sync.set({
        replacements: [
          { from: 'hello', to: 'hi' }  // Default example replacement
        ]
      });
    }
  });
});
