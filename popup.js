document.addEventListener('DOMContentLoaded', function() {
  const replacementsDiv = document.getElementById('replacements');
  const addButton = document.getElementById('addNew');
  const saveButton = document.getElementById('save');
  const saveFeedback = document.querySelector('.save-feedback');

  // Load existing replacements
  chrome.storage.sync.get(['replacements'], function(result) {
    const replacements = result.replacements || [];
    replacements.forEach(pair => addReplacementPair(pair));
  });

  // Add new replacement pair
  addButton.addEventListener('click', () => {
    addReplacementPair({ from: '', to: '' });
  });

  // Save all replacements
  saveButton.addEventListener('click', () => {
    const pairs = [];
    document.querySelectorAll('.replacement-pair').forEach(pair => {
      pairs.push({
        from: pair.querySelector('.from').value,
        to: pair.querySelector('.to').value
      });
    });
    
    chrome.storage.sync.set({ replacements: pairs }, function() {
      // Show save feedback
      saveFeedback.style.display = 'block';
      setTimeout(() => {
        saveFeedback.style.display = 'none';
      }, 2000);
    });
  });

  function addReplacementPair(pair) {
    const div = document.createElement('div');
    div.className = 'replacement-pair';
    div.innerHTML = `
      <label>Text to Replace:</label>
      <textarea class="from" placeholder="Enter text to be replaced">${pair.from || ''}</textarea>
      <label>Replace With:</label>
      <textarea class="to" placeholder="Enter replacement text">${pair.to || ''}</textarea>
      <button class="remove">Remove</button>
    `;
    
    div.querySelector('.remove').addEventListener('click', () => {
      div.style.transform = 'translateX(100%)';
      div.style.opacity = '0';
      setTimeout(() => div.remove(), 200);
    });
    
    replacementsDiv.appendChild(div);
    
    // Focus the first textarea of a new empty pair
    if (!pair.from && !pair.to) {
      div.querySelector('.from').focus();
    }
  }
});
