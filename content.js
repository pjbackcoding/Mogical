// content.js

// Global variable to store replacement pairs fetched from Firestore.
let replacements = [];

// When you need to fetch data from Firestore, send a message to the background script.
chrome.runtime.sendMessage({ action: 'fetchReplacements' }, (response) => {
  if (response.error) {
    console.error('Error fetching replacements:', response.error);
  } else {
    console.log('Fetched replacements:', response.replacements);
    // Save the fetched replacements for use in text replacement.
    replacements = response.replacements;
    // Once replacements are loaded, scan the page for text nodes.
    scanPage();
  }
});

/**************************************
 * Global Variables and Utilities
 **************************************/
let lastProcessedText = new Set(); // Tracks processed text nodes to avoid duplicate processing.

/**
 * Debounce utility to prevent too-frequent processing.
 */
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

/**************************************
 * Text Replacement Logic
 **************************************/
/**
 * Replace text in a given string using the fetched replacement pairs.
 * If isHTML is true, newlines are replaced with <br> tags.
 */
function replaceText(text, isHTML = false) {
  if (!text) return text;
  let newText = text;

  replacements.forEach(pair => {
    if (!pair.from || !pair.to) return;
    try {
      // Escape special regex characters from the "from" text.
      const escapedFrom = pair.from
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\n/g, '\\n');
      const regex = new RegExp(escapedFrom, 'g');
      if (regex.test(newText)) {
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
 * Update the value of an <input> or <textarea> element using its native setter.
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
 * For contenteditable elements, update innerHTML and dispatch an input event.
 */
function applyReactCompatibleHTML(element, newHTML) {
  element.innerHTML = newHTML;
  const event = new Event('input', { bubbles: true });
  element.dispatchEvent(event);
}

/**
 * Process a text node (non-editable text) for replacement.
 */
function processTextNode(node) {
  const originalText = node.textContent;
  const key = `${originalText}_${node.parentElement?.tagName}`;
  if (lastProcessedText.has(key)) return;

  const newText = replaceText(originalText, true);
  if (newText !== originalText) {
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
 * Scan the page for text nodes and process them.
 */
function scanPage() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function (node) {
        // Skip text nodes inside SCRIPT or STYLE elements.
        if (node.parentElement?.tagName === 'SCRIPT' ||
            node.parentElement?.tagName === 'STYLE') {
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

/**************************************
 * DOM Mutation Observer
 **************************************/
const debouncedMutationCallback = debounce((mutations) => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        processTextNode(node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        let textNode;
        while ((textNode = walker.nextNode())) {
          processTextNode(textNode);
        }
      }
    });
  });
}, 3000);

const observer = new MutationObserver(debouncedMutationCallback);
observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
});

/**************************************
 * Input Handling (Editable Elements)
 **************************************/
/**
 * Handle input/change events on editable elements like inputs, textareas,
 * and contenteditable elements.
 */
function handleInput(event) {
  const target = event.target;
  
  // Skip if target is null or if event is programmatic (from our own code).
  if (!target || event._fromMogical) return;

  // Handle different types of editable elements.
  if (target.isContentEditable) {
    // For contenteditable elements
    const originalHTML = target.innerHTML;
    const newHTML = replaceText(originalHTML, true);
    if (newHTML !== originalHTML) {
      // Mark the event so we don't process our own changes
      const customEvent = new Event('input', { bubbles: true });
      customEvent._fromMogical = true;
      
      // Apply changes
      applyReactCompatibleHTML(target, newHTML);
    }
  } 
  else if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    // For standard form controls
    const originalValue = target.value;
    const newValue = replaceText(originalValue);
    if (newValue !== originalValue) {
      // Mark the event so we don't process our own changes
      const customEvent = new Event('input', { bubbles: true });
      customEvent._fromMogical = true;
      
      // Apply changes
      setNativeValue(target, newValue);
    }
  }
}

/**************************************
 * Initialization
 **************************************/
// Listen for input events on editable elements.
document.addEventListener('input', handleInput);
document.addEventListener('change', handleInput);

// Optionally, periodically re-scan the page.
setInterval(scanPage, 1000);
