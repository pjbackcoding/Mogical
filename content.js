// Store replacements in memory
let replacements = [];
let lastProcessedText = new Set(); // Keep track of processed text to avoid duplicates

// Load replacements when the script starts
function loadReplacements() {
  chrome.storage.sync.get(['replacements'], function(result) {
    replacements = result.replacements || [];
    console.log('Loaded replacements:', replacements);
  });
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.replacements) {
    replacements = changes.replacements.newValue;
    console.log('Updated replacements:', replacements);
  }
});

// Function to perform text replacement
function replaceText(text, isHTML = false) {
  if (!text) return text;
  let newText = text;
  
  replacements.forEach(pair => {
    if (!pair.from || !pair.to) return;
    
    try {
      // Create a proper escaped version of the search text
      const escapedFrom = pair.from
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\n/g, '\\n'); // Handle newlines specially
        
      const regex = new RegExp(escapedFrom, 'g');
      
      if (regex.test(newText)) {
        console.log(`Replacing "${pair.from}" with "${pair.to}"`);
        // Handle line breaks differently based on context
        const replacement = isHTML ? pair.to.replace(/\n/g, '<br>') : pair.to;
        newText = newText.replace(regex, replacement);
      }
    } catch (e) {
      console.error('Error during replacement:', e);
    }
  });
  
  return newText;
}

// Function to process a text node
function processTextNode(node) {
  const originalText = node.textContent;
  const key = originalText + '_' + node.parentElement?.tagName;
  
  // Skip if we've already processed this exact text in this location
  if (lastProcessedText.has(key)) return;
  
  const newText = replaceText(originalText, true);
  if (newText !== originalText) {
    console.log('Replacing text node content:', originalText, 'with:', newText);
    // Use innerHTML if the replacement contains HTML tags
    if (newText.includes('<br>')) {
      const span = document.createElement('span');
      span.innerHTML = newText;
      node.parentNode.replaceChild(span, node);
    } else {
      node.textContent = newText;
    }
    lastProcessedText.add(key);
  }
}

// Handle input events for editable elements
function handleInput(event) {
  const element = event.target;
  
  // Only process if it's an editable element
  if (!element.isContentEditable && element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA') {
    return;
  }

  const originalText = element.value || element.textContent;
  // Use regular newlines for input elements
  const newText = replaceText(originalText, element.isContentEditable);
  
  // Only update if text actually changed
  if (newText !== originalText) {
    console.log('Text changed in input:', originalText, 'to:', newText);
    
    if (element.value !== undefined) {
      element.value = newText;
    } else {
      // Use innerHTML for contenteditable elements
      element.innerHTML = newText;
    }
    
    // Preserve cursor position if possible
    if (element.setSelectionRange) {
      const cursorPos = element.selectionStart;
      element.setSelectionRange(cursorPos, cursorPos);
    }
  }
}

// Function to scan the page for text nodes
function scanPage() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip script and style tags
        if (node.parentElement?.tagName === 'SCRIPT' || 
            node.parentElement?.tagName === 'STYLE') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let node;
  while (node = walker.nextNode()) {
    processTextNode(node);
  }
}

// Initialize
loadReplacements();

// Add event listeners for input elements
document.addEventListener('input', handleInput);
document.addEventListener('change', handleInput);

// Watch for DOM changes
const observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    // Process new text nodes
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        processTextNode(node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Scan the new element for text nodes
        const walker = document.createTreeWalker(
          node,
          NodeFilter.SHOW_TEXT,
          null
        );
        let textNode;
        while (textNode = walker.nextNode()) {
          processTextNode(textNode);
        }
      }
    });
  });
});

// Start observing the document with the configured parameters
observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true
});

// Periodically scan the page for new content
setInterval(scanPage, 1000); // Scan every second

// Initial scan
scanPage();
