// content.js

// Store replacements in memory
let replacements = [];
let lastProcessedText = new Set(); // Keep track of processed text to avoid duplicates

// Debounce utility
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

// Load replacements when the script starts
function loadReplacements() {
  chrome.storage.sync.get(['replacements'], function (result) {
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

  replacements.forEach((pair) => {
    if (!pair.from || !pair.to) return;

    try {
      // Create a proper escaped version of the search text
      const escapedFrom = pair.from
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\n/g, '\\n'); // Handle newlines specially

      const regex = new RegExp(escapedFrom, 'g');

      if (regex.test(newText)) {
        console.log(`Replacing "${pair.from}" with "${pair.to}"`);
        // If isHTML, replace \n with <br> in the "to" text
        const replacement = isHTML ? pair.to.replace(/\n/g, '<br>') : pair.to;
        newText = newText.replace(regex, replacement);
      }
    } catch (e) {
      console.error('Error during replacement:', e);
    }
  });

  return newText;
}

/**
 * Use the 'native setter' trick to update an <input> or <textarea>
 * in a way that React/Angular/Vue usually recognize as a real user input.
 */
function setNativeValue(element, value) {
  const prototype = element instanceof HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
    
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor.set.call(element, value);

  const event = new Event('input', { bubbles: true });
  element.dispatchEvent(event);
}

/**
 * For a contenteditable element, we can set innerHTML, then dispatch an input event.
 */
function applyReactCompatibleHTML(element, newHTML) {
  element.innerHTML = newHTML;
  const event = new Event('input', { bubbles: true });
  element.dispatchEvent(event);
}

// Function to process a text node (non-editable normal text in the DOM)
function processTextNode(node) {
  const originalText = node.textContent;
  // Make a key that includes the parent element tag to avoid reprocessing
  const key = `${originalText}_${node.parentElement?.tagName}`;

  // Skip if we've already processed this exact text in this location
  if (lastProcessedText.has(key)) return;

  const newText = replaceText(originalText, true);
  if (newText !== originalText) {
    console.log('Replacing text node content:', originalText, 'with:', newText);
    // If it includes <br>, we need to inject HTML
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

/**
 * Handle input events on editable elements (inputs, textareas, contenteditables).
 * This is where we do the 'native setter' to ensure React sees the updated value.
 */
function handleInput(event) {
  const element = event.target;

  // Only process if it's an editable element
  if (
    !element.isContentEditable &&
    element.tagName !== 'INPUT' &&
    element.tagName !== 'TEXTAREA'
  ) {
    return;
  }

  const originalText = element.value !== undefined
    ? element.value
    : element.textContent;

  const newText = replaceText(originalText, element.isContentEditable);

  // Only update if text actually changed
  if (newText !== originalText) {
    console.log('Text changed in input:', originalText, 'to:', newText);

    if (element.value !== undefined) {
      // <input> or <textarea>
      setNativeValue(element, newText);
    } else if (element.isContentEditable) {
      // contenteditable
      applyReactCompatibleHTML(element, newText);
    }
  }
}

/**
 * Function to scan the page for text nodes (non-editable text).
 */
function scanPage() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function (node) {
        // Skip script and style tags
        if (
          node.parentElement?.tagName === 'SCRIPT' ||
          node.parentElement?.tagName === 'STYLE'
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let node;
  while ((node = walker.nextNode())) {
    processTextNode(node);
  }
}

// Function to simulate a spacebar press
function triggerSpacePress() {
  const element = document.activeElement;
  if (
    !element ||
    !(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)
  ) {
    return;
  }
  
  // Get current value and cursor position
  const start = element.selectionStart;
  const end = element.selectionEnd;
  const currentValue = element.value;
  
  // Insert space at cursor position
  const newValue = currentValue.substring(0, start) + ' ' + currentValue.substring(end);
  
  // Update the value using the native setter
  setNativeValue(element, newValue);
  
  // Restore cursor position after the inserted space
  element.setSelectionRange(start + 1, start + 1);
}

// Initialize
loadReplacements();

// Add event listeners for input/editable elements
document.addEventListener('input', handleInput);
document.addEventListener('change', handleInput);

/**
 * Debounced callback for MutationObserver.
 * This ensures we don't call the inner logic too many times if changes occur rapidly.
 */
const debouncedMutationCallback = debounce((mutations) => {
  mutations.forEach((mutation) => {
    // Process new or changed nodes
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        processTextNode(node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Scan the new element for text nodes
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        let textNode;
        while ((textNode = walker.nextNode())) {
          processTextNode(textNode);
        }
      }
    });
  });
}, 3000); // 3000ms debounce delay (adjust to your preference)

// Watch for DOM changes using our debounced callback
const observer = new MutationObserver(debouncedMutationCallback);
observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
});

// Periodically scan the page for new content if needed (optional)
setInterval(scanPage, 1000); // Scan every second

// Initial scan
scanPage();
