document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY_REPLACEMENTS = 'replacements'; // Same key as in background.js

  const replacementsDiv = document.getElementById('replacements');
  const addButton = document.getElementById('addNew');
  const saveButton = document.getElementById('save');
  const saveFeedback = document.querySelector('.save-feedback');

  // 1. Load existing replacements from chrome.storage
  chrome.storage.sync.get([STORAGE_KEY_REPLACEMENTS], (result) => {
    if (chrome.runtime.lastError) {
      console.error(`Error loading replacements: ${chrome.runtime.lastError.message}`);
      // Optionally, display an error to the user in the popup
      return;
    }
    const replacements = result[STORAGE_KEY_REPLACEMENTS] || [];
    replacements.forEach((pair) => addReplacementPair(pair));
  });

  // 2. Add new replacement pair (with empty fields)
  addButton.addEventListener('click', () => {
    addReplacementPair({ from: '', to: '' });
  });

  // 3. Save all replacements to chrome.storage
  saveButton.addEventListener('click', () => {
    const pairs = [];
    document.querySelectorAll('.replacement-pair').forEach((pairElement) => { // Renamed 'pair' to 'pairElement' to avoid conflict
      const fromText = pairElement.querySelector('.from').value.trim();
      const toText = pairElement.querySelector('.to').value.trim();
      // Basic validation: at least the 'from' field should not be empty
      if (fromText) { // You might want more sophisticated validation
        pairs.push({ from: fromText, to: toText });
      }
    });

    chrome.storage.sync.set({ [STORAGE_KEY_REPLACEMENTS]: pairs }, () => {
      if (chrome.runtime.lastError) {
        console.error(`Error saving replacements: ${chrome.runtime.lastError.message}`);
        // Optionally, display an error to the user
        saveFeedback.textContent = 'Error saving changes!';
        saveFeedback.style.backgroundColor = '#e74c3c'; // Error color
      } else {
        saveFeedback.textContent = 'Changes saved successfully!';
        saveFeedback.style.backgroundColor = '#2ecc71'; // Success color
      }
      
      saveFeedback.style.display = 'block';
      setTimeout(() => {
        saveFeedback.style.display = 'none';
      }, 2000);
    });
  });

  // Helper function: create and inject a replacement-pair element
  function addReplacementPair(pairData) { // Renamed 'pair' to 'pairData'
    const div = document.createElement('div');
    div.className = 'replacement-pair';

    div.innerHTML = `
      <label>Text to Replace:</label>
      <textarea class="from" placeholder="Enter text to be replaced">${pairData.from || ''}</textarea>
      <label>Replace With:</label>
      <textarea class="to" placeholder="Enter replacement text">${pairData.to || ''}</textarea>
      <button class="remove">Remove</button>
    `;

    div.querySelector('.remove').addEventListener('click', () => {
      div.style.transform = 'translateX(100%)';
      div.style.opacity = '0';
      setTimeout(() => {
        div.remove();
      }, 200);
    });

    replacementsDiv.appendChild(div);

    if (!pairData.from && !pairData.to) {
      div.querySelector('.from').focus();
    }
  }
});
