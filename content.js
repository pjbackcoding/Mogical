// content.js
const STORAGE_KEY_REPLACEMENTS = 'replacements';

let currentReplacements = [];
const processedTextNodes = new Set(); // To avoid re-processing identical text nodes in the same context

function loadReplacementsFromStorage() {
  chrome.storage.sync.get([STORAGE_KEY_REPLACEMENTS], (result) => {
    if (chrome.runtime.lastError) {
      console.error(`Error loading replacements: ${chrome.runtime.lastError.message}`);
      currentReplacements = [];
      return;
    }
    currentReplacements = result[STORAGE_KEY_REPLACEMENTS] || [];
    // console.log('Mogical: Replacements loaded:', currentReplacements);
    // When replacements change, we might need to re-process the page.
    // For simplicity, clear processed nodes so they can be re-evaluated.
    processedTextNodes.clear();
    scanPageForTextNodes(); // Re-scan static text with new rules
  });
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes[STORAGE_KEY_REPLACEMENTS]) {
    currentReplacements = changes[STORAGE_KEY_REPLACEMENTS].newValue || [];
    // console.log('Mogical: Replacements updated:', currentReplacements);
    processedTextNodes.clear();
    scanPageForTextNodes(); // Re-scan static text with new rules
  }
});

function performTextReplacement(text, isHTMLContext = false) {
  if (typeof text !== 'string' || !text || !currentReplacements || currentReplacements.length === 0) {
    return text;
  }
  let newText = text;

  // Sort replacements by length (longest first) to handle overlapping patterns correctly
  const sortedReplacements = [...currentReplacements].sort((a, b) => 
    (b.from?.length || 0) - (a.from?.length || 0)
  );

  sortedReplacements.forEach((pair) => {
    if (typeof pair.from !== 'string' || !pair.from) {
      return; // 'from' must be a non-empty string
    }
    const toText = typeof pair.to === 'string' ? pair.to : ''; // Default 'to' to empty string

    try {
      // Escape 'from' string to be used in RegExp constructor
      const escapedFrom = pair.from.replace(/[.*+?^${}()|[\]\]/g, '\$&');
      
      // For HTML context, \n matches <br> or newlines; for non-HTML, \n matches only newlines.
      const regexPattern = isHTMLContext ? 
        escapedFrom.replace(/\n/g, '(?:\n|<br\s*\/?>)') : 
        escapedFrom.replace(/\n/g, '\n');

      // Using word boundary check for whole word replacements if the pattern looks like a word
      // Only apply word boundaries if the pattern is a word-like structure
      const shouldUseWordBoundary = /^\w+$/.test(pair.from);
      const finalPattern = shouldUseWordBoundary ? `\b${regexPattern}\b` : regexPattern;
      
      const regex = new RegExp(finalPattern, 'g'); // Global replacement

      // Use a test and replace approach that works reliably
      // Reset regex lastIndex before testing to ensure consistent behavior
      regex.lastIndex = 0;
      if (regex.test(newText)) {
        // Reset regex lastIndex again before replacement
        regex.lastIndex = 0;
        const effectiveToText = isHTMLContext ? toText.replace(/\n/g, '<br>') : toText;
        newText = newText.replace(regex, effectiveToText);
      }
    } catch (e) {
      console.error('Mogical: Error during replacement:', e, 'for pair:', pair);
    }
  });
  return newText;
}

function setElementValueNatively(element, value) {
  const proto = Object.getPrototypeOf(element);
  const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

  if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    // Fallback if no native setter is found (e.g., some custom elements)
    element.value = value;
  }

  // Dispatch input and change events to notify frameworks
  element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
}

function setContentEditableHTML(element, html) {
  element.innerHTML = html;
  element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
}

function processSingleTextNode(node) {
  if (!node || node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) {
    return;
  }

  const originalText = node.textContent;
  // A more robust key or using a WeakSet for `processedTextNodes` might be better for complex scenarios.
  const processingKey = `${originalText}_${node.parentNode?.tagName}_${Array.from(node.parentNode?.childNodes || []).indexOf(node)}`;
  if (processedTextNodes.has(processingKey)) {
    return;
  }

  const newText = performTextReplacement(originalText, true);

  if (newText !== originalText) {
    // console.log('Mogical: Replacing text node content:', originalText, '->', newText);
    if (newText.includes('<') || newText.includes('&')) { // Potential HTML content
      const tempContainer = document.createElement('div');
      tempContainer.innerHTML = newText; // Safely parse the HTML string
      
      const parent = node.parentNode;
      if (parent) {
        while (tempContainer.firstChild) {
          parent.insertBefore(tempContainer.firstChild, node);
        }
        parent.removeChild(node);
      }
    } else {
      node.textContent = newText; // Simple text replacement
    }
    processedTextNodes.add(processingKey);
  }
}

function handleEditableElementInput(event) {
  const element = event.target;

  if (!element || element.type === 'password' || 
      !(element.isContentEditable || element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
    return;
  }
  // Avoid processing inputs not in a form unless they are contentEditable (heuristic)
  if (element.tagName !== 'BODY' && !element.isContentEditable && !element.closest('form')){
      // console.log('Mogical: Skipping non-form input unless contenteditable:', element);
      return;
  }

  const originalContent = element.isContentEditable ? element.innerHTML : element.value;
  const newContent = performTextReplacement(originalContent, element.isContentEditable);

  if (newContent !== originalContent) {
    // console.log('Mogical: Text changed in editable:', originalContent, '->', newContent);
    if (element.isContentEditable) {
      setContentEditableHTML(element, newContent);
    } else {
      setElementValueNatively(element, newContent);
    }
  }
}

function scanPageForTextNodes() {
  // console.log('Mogical: Scanning page for text nodes...');
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function (node) {
        const parentTag = node.parentElement?.tagName;
        if (parentTag === 'SCRIPT' || parentTag === 'STYLE' || parentTag === 'TEXTAREA' || 
            node.parentElement?.isContentEditable || node.parentElement?.closest('[contenteditable="true"]')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    },
    // false // deprecated in modern browsers
  );

  let node;
  const nodesToProcess = [];
  while ((node = walker.nextNode())) {
    nodesToProcess.push(node); // Collect nodes first
  }
  // Process collected nodes to avoid issues if DOM changes during traversal
  nodesToProcess.forEach(processSingleTextNode);
}

/*
// Function to simulate a spacebar press (Commented out as unused)
function triggerSpacePress() {
  const element = document.activeElement;
  if (!element || !(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return;
  const start = element.selectionStart;
  const end = element.selectionEnd;
  const currentValue = element.value;
  const newValue = currentValue.substring(0, start) + ' ' + currentValue.substring(end);
  setElementValueNatively(element, newValue);
  element.setSelectionRange(start + 1, start + 1);
}
*/

// Initial load of replacements
loadReplacementsFromStorage();

// Event listener for input on editable elements (capture phase recommended)
document.addEventListener('input', handleEditableElementInput, true);

// MutationObserver to watch for DOM changes
const domObserver = new MutationObserver((mutations) => {
  // Debounce or throttle this callback if performance becomes an issue
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          processSingleTextNode(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          // Scan the new element and its children for text nodes
          const treeWalker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
             acceptNode: function (n) {
                const pTag = n.parentElement?.tagName;
                if (pTag === 'SCRIPT' || pTag === 'STYLE' || pTag === 'TEXTAREA' || 
                    n.parentElement?.isContentEditable || n.parentElement?.closest('[contenteditable="true"]')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
          });
          let textNode;
          while(textNode = treeWalker.nextNode()) {
            processSingleTextNode(textNode);
          }
        }
      });
    } else if (mutation.type === 'characterData') {
      // Process the target node if it's a text node and not inside an editable element
      if (mutation.target.nodeType === Node.TEXT_NODE) {
        const parentElement = mutation.target.parentElement;
        if (parentElement && parentElement.tagName !== 'TEXTAREA' && !parentElement.isContentEditable && !parentElement.closest('[contenteditable="true"]')) {
            processSingleTextNode(mutation.target);
        }
      }
    }
  }
});

// Start observing the document body for changes
if (document.body) { // Ensure body exists before observing
    domObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
    });
} else {
    // If body is not yet available, wait for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
        domObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
        });
        // Initial scan after DOM is fully loaded
        setTimeout(scanPageForTextNodes, 500); // Delay slightly for dynamic content
    });
}

// Fallback initial scan if DOMContentLoaded already fired or body exists
if (document.readyState === 'complete' || document.readyState === 'interactive' && document.body) {
    setTimeout(scanPageForTextNodes, 500); // Delay slightly for dynamic content
} else {
    window.addEventListener('load', () => { // Failsafe: scan after all resources load
        setTimeout(scanPageForTextNodes, 500);
    });
}

// The periodic scan is removed in favor of MutationObserver and strategic re-scans.
// // setInterval(scanPageForTextNodes, 3000); // Example: less frequent periodic scan if needed
