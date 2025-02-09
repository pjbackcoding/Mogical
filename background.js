// background.js
// Import your bundled Firebase libraries as modules.
// Ensure that firebase_app.js exports the Firebase object and that firebase_firestore.js
// augments it with Firestore functionality.
import firebase from './firebase_app.js';
import './firebase_firestore.js';

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

// On extension installation, set default replacements (if none exist) in chrome.storage.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['replacements'], (result) => {
    if (!result.replacements) {
      chrome.storage.sync.set({
        replacements: [
          { from: 'hello', to: 'hi' }  // Default replacement pair.
        ]
      });
      console.log("Default replacements have been set.");
    }
  });
});

// Listen for messages from content scripts.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchReplacements') {
    // Fetch the replacements collection from Firestore.
    db.collection('replacements').get()
      .then((querySnapshot) => {
        const replacements = [];
        querySnapshot.forEach(doc => {
          replacements.push({ id: doc.id, ...doc.data() });
        });
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
