// background.js

const STORAGE_KEY_REPLACEMENTS = 'replacements';

// Initialize default replacements if none exist
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get([STORAGE_KEY_REPLACEMENTS], function(result) {
    if (chrome.runtime.lastError) {
      console.error(`Error getting replacements: ${chrome.runtime.lastError.message}`);
      return;
    }

    if (!result[STORAGE_KEY_REPLACEMENTS]) {
      chrome.storage.sync.set({
        [STORAGE_KEY_REPLACEMENTS]: [
          { from: 'hello', to: 'Hi there!' },  // Basic example
          { from: 'br', to: 'Best regards,\nYour Name' },  // Multi-line signature
          { from: 'myemail', to: 'your.email@example.com' },  // Contact info
          { from: 'tdate', to: new Date().toLocaleDateString() }  // Current date
        ]
      }, function() {
        if (chrome.runtime.lastError) {
          console.error(`Error setting default replacements: ${chrome.runtime.lastError.message}`);
        } else {
          console.log('Default replacements initialized.');
        }
      });
    } else {
      console.log('Replacements already exist, no defaults initialized.');
    }
  });
});
