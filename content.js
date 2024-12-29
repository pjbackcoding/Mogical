// content.js

// Store replacements in memory
let replacements = [];
let lastProcessedText = new Set(); // Keep track of processed text to avoid duplicates

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
function applyReactCompatibleValue(element, newValue) {
  // If it's a <textarea>, use the prototype descriptor from HTMLTextAreaElement
  // If it's an <input>, use the prototype descriptor from HTMLInputElement
  const prototype = element instanceof HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;

  const nativeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
  // Set the 'value' property as if the user typed it
  nativeValueSetter.call(element, newValue);

  // Dispatch the 'input' event so frameworks see the change
  const event = new Event('input', { bubbles: true });
  element.dispatchEvent(event);
}

/**
 * For a contenteditable element, we can set innerHTML, then dispatch an input event.
 */
function applyReactCompatibleHTML(element, newHTML) {
  // You could consider using document.execCommand('insertHTML') (though deprecated)
  // element.focus();
  // document.execCommand('insertHTML', false, newHTML);

  // Simpler approach: directly set innerHTML
  element.innerHTML = newHTML;

  // Fire an input event so React/Angular see the change
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

  // Use regular newlines for input/textarea; for contenteditable, we may do <br>
  // So pass `element.isContentEditable` to replaceText if needed
  const newText = replaceText(originalText, element.isContentEditable);

  // Only update if text actually changed
  if (newText !== originalText) {
    console.log('Text changed in input:', originalText, 'to:', newText);

    if (element.value !== undefined) {
      // <input> or <textarea>
      applyReactCompatibleValue(element, newText);
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

// Initialize
loadReplacements();

// Add event listeners for input/editable elements
document.addEventListener('input', handleInput);
document.addEventListener('change', handleInput);

// Watch for DOM changes
const observer = new MutationObserver((mutations) => {
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
});

// Start observing the document with the configured parameters
observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
});

// Periodically scan the page for new content if needed (optional)
setInterval(scanPage, 1000); // Scan every second

// Initial scan
scanPage();
