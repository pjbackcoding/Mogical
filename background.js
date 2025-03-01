// background.js
// Load Firebase libraries using importScripts for Manifest V3 service worker
importScripts('firebase_app.js', 'firebase_firestore.js');

// Now firebase is available as a global object

// Firebase configuration for your project.
const firebaseConfig = {
  apiKey: "AIzaSyCxsa1uSbzOd-kZKoh-qr1LON6uziAsZto",
  authDomain: "mogical-5f0d0.firebaseapp.com",
  projectId: "mogical-5f0d0",
  storageBucket: "mogical-5f0d0.firebasestorage.app",
  messagingSenderId: "1007731277390",
  appId: "1:1007731277390:web:147574552085e1961d0d1f",
  measurementId: "G-LEKW019EGH"
};

// Initialize Firebase if it hasn’t been initialized yet.
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
} else {
  firebase.app();
}

// Create a Firestore database reference.
const db = firebase.firestore();
console.log("Firebase initialized and Firestore 'db' is ready.");

// On extension installation, set default replacements in both chrome.storage and Firestore.
chrome.runtime.onInstalled.addListener(() => {
  // Check if default replacements need to be set
  chrome.storage.sync.get(['replacements'], (result) => {
    if (!result.replacements) {
      const defaultReplacements = [
        { from: 'hello', to: 'hi' }  // Default replacement pair.
      ];
      
      // Set in chrome.storage
      chrome.storage.sync.set({
        replacements: defaultReplacements
      });
      
      // Also set in Firestore if collection is empty
      db.collection('replacements_collection').get().then(snapshot => {
        if (snapshot.empty) {
          // Collection is empty, add default replacements
          const batch = db.batch();
          
          defaultReplacements.forEach(pair => {
            const docRef = db.collection('replacements_collection').doc();
            batch.set(docRef, pair);
          });
          
          return batch.commit();
        }
      }).then(() => {
        console.log("Default replacements have been set in both chrome.storage and Firestore.");
      }).catch(error => {
        console.error("Error setting default replacements in Firestore:", error);
      });
    }
  });
});

// Listen for messages from content scripts.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchReplacements') {
    // Fetch the replacements_collection from Firestore.
    db.collection('replacements_collection').get()
      .then((querySnapshot) => {
        const replacements = [];
        querySnapshot.forEach(doc => {
          // Adapting to the specific structure with 'from' and 'to' fields
          const data = doc.data();
          if (data.from !== undefined && data.to !== undefined) {
            replacements.push({ 
              id: doc.id, 
              from: data.from, 
              to: data.to 
            });
          }
        });
        console.log('Fetched replacements:', replacements);
        sendResponse({ replacements });
      })
      .catch((error) => {
        console.error('Error fetching replacements:', error);
        sendResponse({ error: error.message });
      });
    // Return true to indicate that we are sending a response asynchronously.
    return true;
  }

  // (You can add additional message actions here for create/update/delete operations if needed.)
});
