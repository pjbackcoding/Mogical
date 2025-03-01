document.addEventListener('DOMContentLoaded', () => {
  const replacementsDiv = document.getElementById('replacements');
  const addButton = document.getElementById('addNew');
  const saveButton = document.getElementById('save');
  const saveFeedback = document.querySelector('.save-feedback');
  
  // Initialize Firebase
  const firebaseConfig = {
    apiKey: "AIzaSyCxsa1uSbzOd-kZKoh-qr1LON6uziAsZto",
    authDomain: "mogical-5f0d0.firebaseapp.com",
    projectId: "mogical-5f0d0",
    storageBucket: "mogical-5f0d0.firebasestorage.app",
    messagingSenderId: "1007731277390",
    appId: "1:1007731277390:web:147574552085e1961d0d1f",
    measurementId: "G-LEKW019EGH"
  };

  // Initialize Firebase if it hasn't been initialized yet
  if (!firebase.apps || !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  } else {
    firebase.app();
  }

  // Create a Firestore database reference
  const db = firebase.firestore();
  console.log("Firebase initialized for popup.js");

  // 1. Load existing replacements from Firestore
  db.collection('replacements_collection').get().then((querySnapshot) => {
    const replacements = [];
    querySnapshot.forEach(doc => {
      const data = doc.data();
      replacements.push({ 
        id: doc.id, 
        from: data.from || '', 
        to: data.to || '' 
      });
    });
    console.log('Loaded replacements from Firestore:', replacements);
    replacements.forEach((pair) => addReplacementPair(pair));
  }).catch(error => {
    console.error('Error loading replacements from Firestore:', error);
    // Fall back to chrome.storage if Firestore fails
    chrome.storage.sync.get(['replacements'], (result) => {
      const replacements = result.replacements || [];
      replacements.forEach((pair) => addReplacementPair(pair));
    });
  });

  // 2. Add new replacement pair (with empty fields)
  addButton.addEventListener('click', () => {
    addReplacementPair({ from: '', to: '' });
  });

  // 3. Save all replacements to Firestore
  saveButton.addEventListener('click', () => {
    const pairs = [];
    document.querySelectorAll('.replacement-pair').forEach((pair) => {
      const fromText = pair.querySelector('.from').value.trim();
      const toText = pair.querySelector('.to').value.trim();
      // Only save non-empty pairs
      if (fromText || toText) {
        pairs.push({ from: fromText, to: toText });
      }
    });

    // First, store in chrome.storage for backup
    chrome.storage.sync.set({ replacements: pairs });
    
    // Then store in Firestore
    const db = firebase.firestore();
    const batch = db.batch();
    
    // First delete all existing documents in the collection
    db.collection('replacements_collection').get().then((querySnapshot) => {
      // Delete existing documents
      querySnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Add new documents
      pairs.forEach(pair => {
        const docRef = db.collection('replacements_collection').doc();
        batch.set(docRef, pair);
      });
      
      // Commit the batch
      return batch.commit();
    })
    .then(() => {
      console.log('Replacements saved to Firestore successfully');
      // Show save feedback and hide it after 2 seconds
      saveFeedback.style.display = 'block';
      setTimeout(() => {
        saveFeedback.style.display = 'none';
      }, 2000);
    })
    .catch(error => {
      console.error('Error saving to Firestore:', error);
      alert('Error saving replacements: ' + error.message);
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
