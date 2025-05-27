// content.js - Extremely simplified version
const STORAGE_KEY_REPLACEMENTS = 'replacements';

// Global state
let currentReplacements = [];
const processedTextNodes = new Set(); 

// Load replacements from storage
function loadReplacementsFromStorage() {
  chrome.storage.sync.get([STORAGE_KEY_REPLACEMENTS], (result) => {
    if (chrome.runtime.lastError) {
      console.error(`Error loading replacements: ${chrome.runtime.lastError.message}`);
      currentReplacements = [];
      return;
    }
    currentReplacements = result[STORAGE_KEY_REPLACEMENTS] || [];
    
    // DEBUG: Log détaillé des remplacements
    console.log('Mogical: Loaded replacements:', JSON.stringify(currentReplacements));
    console.log('Mogical: Nombre de remplacements:', currentReplacements.length);
    
    // DEBUG: Force test replacement si aucun n'est défini
    if (currentReplacements.length === 0) {
      console.log('Mogical: DEBUG - Ajout d\'un remplacement de test');
      currentReplacements = [
        { from: 'test', to: 'TEST RÉUSSI' },
        { from: 'hello', to: 'bonjour' }
      ];
    }
    
    // DEBUG: Vérification individuelle de chaque remplacement
    currentReplacements.forEach((r, i) => {
      console.log(`Mogical: Remplacement #${i + 1}:`, r.from, '->', r.to);
    });
    
    processedTextNodes.clear();
    scanPageForTextNodes();
  });
}

// Listen for changes in storage
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes[STORAGE_KEY_REPLACEMENTS]) {
    currentReplacements = changes[STORAGE_KEY_REPLACEMENTS].newValue || [];
    console.log('Mogical: Updated replacements:', currentReplacements);
    processedTextNodes.clear();
    scanPageForTextNodes();
  }
});

// Simple text replacement function - no regex for maximum reliability
function performTextReplacement(text, isHTMLContext = false) {
  console.log('Mogical: performTextReplacement appelé avec:', text.substring(0, 50), isHTMLContext ? '(HTML)' : '(texte)');
  
  if (typeof text !== 'string' || !text || !currentReplacements || currentReplacements.length === 0) {
    console.log('Mogical: Remplacement ignoré - texte invalide ou pas de remplacements');
    return text;
  }
  
  // Vérification spéciale pour les raccourcis (commandes) commençant par tiret
  if (text.trim().startsWith('-')) {
    console.log('Mogical: Détection d\'un raccourci potentiel:', text.trim());
    
    // Extraire le premier mot (jusqu'au premier espace ou fin de ligne)
    const commandParts = text.trim().split(/\s+/);
    const command = commandParts[0]; // Premier mot, potentiellement un raccourci comme "-tel"
    
    console.log('Mogical: Commande détectée:', command);
    
    // Vérifier si ce raccourci existe dans nos remplacements
    for (const pair of currentReplacements) {
      if (pair.from === command) {
        console.log('Mogical: CORRESPONDANCE DE COMMANDE TROUVÉE pour', command);
        // Si c'est un raccourci connu, remplacer tout le texte par le remplacement
        return pair.to;
      }
    }
  }
  
  let newText = text;
  console.log('Mogical: Nombre de remplacements à appliquer:', currentReplacements.length);
  
  // Sort by length (longest first) to avoid partial replacements
  const sortedReplacements = [...currentReplacements].sort((a, b) => 
    (b.from?.length || 0) - (a.from?.length || 0)
  );
  
  // Débug direct: Tester le remplacement de 'test' par 'TEST DEBUG'
  if (text.includes('test')) {
    console.log('Mogical: TEST DIRECT - "test" trouvé dans le texte');
    newText = text.replace(/test/g, 'TEST DEBUG');
    console.log('Mogical: Texte après remplacement direct:', newText);
    return newText;
  }
  
  for (const pair of sortedReplacements) {
    if (!pair.from) {
      console.log('Mogical: Paire ignorée - fromText vide');
      continue;
    }
    
    const fromText = pair.from;
    const toText = pair.to || '';
    
    console.log(`Mogical: Vérification du remplacement: "${fromText}" -> "${toText}"`);
    
    try {
      // Test explicite pour voir si le texte à remplacer est présent
      if (newText.indexOf(fromText) >= 0) {
        console.log(`Mogical: MATCH TROUVÉ pour "${fromText}"!`);
        
        if (isHTMLContext) {
          // Handle HTML context
          const effectiveToText = toText.replace(/\n/g, '<br>');
          console.log(`Mogical: Remplacement HTML: "${fromText}" -> "${effectiveToText}"`);
          newText = newText.split(fromText).join(effectiveToText);
        } else {
          // Simple text replacement
          console.log(`Mogical: Remplacement texte: "${fromText}" -> "${toText}"`);
          newText = newText.split(fromText).join(toText);
        }
      } else {
        console.log(`Mogical: Pas de correspondance pour "${fromText}"`);
      }
    } catch (e) {
      console.error('Mogical: Erreur lors du remplacement:', e);
    }
  }
  
  if (newText !== text) {
    console.log('Mogical: Texte modifié après remplacements!');
  } else {
    console.log('Mogical: Aucun changement après traitement');
  }
  
  return newText;
}

// Set element value and trigger events
function setElementValueNatively(element, value) {
  try {
    // Try to use the setter if possible
    const proto = Object.getPrototypeOf(element);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    
    if (setter) {
      setter.call(element, value);
    } else {
      element.value = value;
    }
    
    // Trigger events
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } catch (e) {
    console.log('Mogical: Error setting value:', e);
    // Fallback
    element.value = value;
  }
}

// Set content for contentEditable elements
function setContentEditableHTML(element, html) {
  element.innerHTML = html;
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

// Process a single text node
function processSingleTextNode(node) {
  if (!node || node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) {
    return;
  }

  const originalText = node.textContent;
  
  // Create a key to avoid processing the same node multiple times
  const processingKey = `${originalText}_${node.parentNode?.tagName}`;
  if (processedTextNodes.has(processingKey)) {
    return;
  }

  // Perform the replacement
  const newText = performTextReplacement(originalText, true);

  // Only update if the text actually changed
  if (newText !== originalText) {
    console.log('Mogical: Replacing:', originalText, '->', newText);
    
    // Check if the replacement contains HTML
    if (newText.includes('<') || newText.includes('&')) {
      try {
        // Handle HTML replacement
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = newText;
        
        const parent = node.parentNode;
        if (parent) {
          while (tempContainer.firstChild) {
            parent.insertBefore(tempContainer.firstChild, node);
          }
          parent.removeChild(node);
        }
      } catch (e) {
        // Fallback to simple text replacement if HTML parsing fails
        node.textContent = newText;
      }
    } else {
      // Simple text replacement
      node.textContent = newText;
    }
    
    processedTextNodes.add(processingKey);
  }
}

// Handle input events in editable elements
function handleEditableElementInput(event) {
  // DEBUG: Log que la fonction est appelée
  console.log('Mogical: Input event reçu', event.type, event.target.tagName);
  
  const element = event.target;

  // Skip elements that shouldn't be processed
  if (!element || 
      element.type === 'password' || 
      !(element.isContentEditable || element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
    console.log('Mogical: Élément ignoré - type non compatible');
    return;
  }
  
  // Accepter tous les champs de texte, même s'ils ne sont pas dans un formulaire
  // Note: Nous ne filtrons plus sur la présence d'un formulaire
  console.log('Mogical: Élément accepté - champ de texte détecté');

  // Get current content
  const originalContent = element.isContentEditable ? element.innerHTML : element.value;
  console.log('Mogical: Contenu original:', originalContent);
  console.log('Mogical: Nombre de remplacements actifs:', currentReplacements.length);
  
  // DEBUG: Test forcé avec un contenu simple
  if (originalContent.includes('test')) {
    console.log('Mogical: Le mot "test" a été détecté!');
  }
  
  if (originalContent.includes('hello')) {
    console.log('Mogical: Le mot "hello" a été détecté!');
  }
  
  // Replace text
  const newContent = performTextReplacement(originalContent, element.isContentEditable);
  console.log('Mogical: Contenu après remplacement potentiel:', newContent);

  // Only update if content changed
  if (newContent !== originalContent) {
    console.log('Mogical: REMPLACEMENT EFFECTUÉ!');
    console.log('Mogical: Replacing in editable:', originalContent, '->', newContent);
    
    if (element.isContentEditable) {
      setContentEditableHTML(element, newContent);
    } else {
      setElementValueNatively(element, newContent);
    }
  } else {
    console.log('Mogical: Aucun changement détecté dans le contenu');
  }
}

// Scan the page for text nodes to process
function scanPageForTextNodes() {
  console.log('Mogical: Scanning page for text nodes...');
  
  try {
    // Check if body exists
    if (!document.body) {
      console.log('Mogical: Body not available yet');
      return;
    }
    
    // Create a tree walker to find text nodes
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          // Skip nodes inside scripts, styles, and editable elements
          const parentTag = node.parentElement?.tagName;
          if (parentTag === 'SCRIPT' || 
              parentTag === 'STYLE' || 
              parentTag === 'TEXTAREA' || 
              node.parentElement?.isContentEditable || 
              node.parentElement?.closest('[contenteditable="true"]')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    // Collect nodes to process
    const nodesToProcess = [];
    let node;
    while ((node = walker.nextNode())) {
      nodesToProcess.push(node);
    }
    
    // Process all collected nodes
    console.log(`Mogical: Found ${nodesToProcess.length} text nodes to process`);
    nodesToProcess.forEach(processSingleTextNode);
  } catch (e) {
    console.error('Mogical: Error scanning page:', e);
  }
}

// Main initialization code
function initMogical() {
  console.log('Mogical: Initializing extension...');
  
  // Load initial replacements
  loadReplacementsFromStorage();
  
  // Set up input event listener
  document.addEventListener('input', handleEditableElementInput, true);
  
  // Set up mutation observer
  setupMutationObserver();
  
  // Initial scan for existing text
  setTimeout(scanPageForTextNodes, 500);
  
  console.log('Mogical: Initialization complete');
}

// Set up mutation observer to watch for DOM changes
function setupMutationObserver() {
  try {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Handle new nodes
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
              // Process added text nodes directly
              processSingleTextNode(node);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              // Process text nodes inside added elements
              try {
                const walker = document.createTreeWalker(
                  node, 
                  NodeFilter.SHOW_TEXT,
                  {
                    acceptNode: function(n) {
                      const parent = n.parentElement;
                      if (!parent || 
                          parent.tagName === 'SCRIPT' || 
                          parent.tagName === 'STYLE' || 
                          parent.tagName === 'TEXTAREA' ||
                          parent.isContentEditable || 
                          parent.closest('[contenteditable="true"]')) {
                        return NodeFilter.FILTER_REJECT;
                      }
                      return NodeFilter.FILTER_ACCEPT;
                    }
                  }
                );
                
                let textNode;
                while (textNode = walker.nextNode()) {
                  processSingleTextNode(textNode);
                }
              } catch (e) {
                console.error('Mogical: Error processing element node:', e);
              }
            }
          });
        } 
        // Handle text changes
        else if (mutation.type === 'characterData') {
          if (mutation.target.nodeType === Node.TEXT_NODE) {
            const parent = mutation.target.parentElement;
            if (parent && 
                parent.tagName !== 'TEXTAREA' && 
                !parent.isContentEditable && 
                !parent.closest('[contenteditable="true"]')) {
              processSingleTextNode(mutation.target);
            }
          }
        }
      }
    });
    
    // Start observing if body exists
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
      console.log('Mogical: Mutation observer started');
    } else {
      // Wait for body to be available
      document.addEventListener('DOMContentLoaded', () => {
        if (document.body) {
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
          });
          console.log('Mogical: Mutation observer started (delayed)');
        }
      });
    }
  } catch (e) {
    console.error('Mogical: Error setting up mutation observer:', e);
  }
}

// Start the extension
console.log('Mogical: Extension loaded');
initMogical();
