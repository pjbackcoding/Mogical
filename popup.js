document.addEventListener('DOMContentLoaded', () => {
  const replacementsDiv = document.getElementById('replacements');
  const addButton = document.getElementById('addNew');
  const saveButton = document.getElementById('save');
  const saveFeedback = document.querySelector('.save-feedback');

  // 1. Load existing replacements from chrome.storage
  chrome.storage.sync.get(['replacements'], (result) => {
    const replacements = result.replacements || [];
    replacements.forEach((pair) => addReplacementPair(pair));
  });

  // 2. Add new replacement pair (with empty fields)
  addButton.addEventListener('click', () => {
    addReplacementPair({ from: '', to: '' });
  });

  // 3. Save all replacements to chrome.storage
  saveButton.addEventListener('click', () => {
    const pairs = [];
    document.querySelectorAll('.replacement-pair').forEach((pair) => {
      const fromText = pair.querySelector('.from').value.trim();
      const toText = pair.querySelector('.to').value.trim();
      pairs.push({ from: fromText, to: toText });
    });

    chrome.storage.sync.set({ replacements: pairs }, () => {
      // Show save feedback and hide it after 2 seconds
      saveFeedback.style.display = 'block';
      setTimeout(() => {
        saveFeedback.style.display = 'none';
      }, 2000);
    });
  });

  // Helper function: create and inject a replacement-pair element
  function addReplacementPair(pair) {
    // Create the container for the "from" and "to" fields
    const div = document.createElement('div');
    div.className = 'replacement-pair';

    div.innerHTML = `
      <label>Text to Replace:</label>
      <textarea class="from" placeholder="Enter text to be replaced">${pair.from || ''}</textarea>
      <label>Replace With:</label>
      <textarea class="to" placeholder="Enter replacement text">${pair.to || ''}</textarea>
      <button class="remove">Remove</button>
    `;

    // Set up the remove button animation & removal
    div.querySelector('.remove').addEventListener('click', () => {
      div.style.transform = 'translateX(100%)';
      div.style.opacity = '0';
      setTimeout(() => {
        div.remove();
      }, 200);
    });

    // Append the new pair to the replacements container
    replacementsDiv.appendChild(div);

    // Focus the first textarea if it's a new empty pair
    if (!pair.from && !pair.to) {
      div.querySelector('.from').focus();
    }
  }
});
