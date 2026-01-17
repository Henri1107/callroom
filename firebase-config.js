// ============================================
// FIREBASE KONFIGURATION
// ============================================
// Bitte füge deine Firebase Konfiguration hier ein:
// 
// Diese erhältst du von: https://console.firebase.google.com/
// 1. Gehe zu Projekteinstellungen
// 2. Wähle dein Web-App aus
// 3. Kopiere die Konfiguration unten ein

const firebaseConfig = {
    apiKey: "AIzaSyDMwwSHhZ44TQ9yWvaqzoFERQMEsPtXhW4",
    authDomain: "callroom-hdh.firebaseapp.com",
    databaseURL: "https://callroom-hdh-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "callroom-hdh",
    storageBucket: "callroom-hdh.firebasestorage.app",
    messagingSenderId: "277014698024",
    appId: "1:277014698024:web:7f5433b89465e72fd03d1d"
};

// Firebase initialisieren
try {
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase erfolgreich initialisiert');
} catch (error) {
    console.error('Fehler beim Initialisieren von Firebase:', error);
}

// Globale Firebase Referenzen
let firebaseDB = null;
let firebaseAuth = null;

try {
    firebaseDB = firebase.database();
    firebaseAuth = firebase.auth();
    // Auch als window Eigenschaft verfügbar machen
    window.firebaseDB = firebaseDB;
    window.firebaseAuth = firebaseAuth;
    console.log('✓ Firebase Database und Auth bereit');
    console.log('✓ Database URL:', firebaseConfig.databaseURL);
} catch (error) {
    console.error('✗ Fehler beim Abrufen von Firebase Diensten:', error);
    firebaseDB = null;
    firebaseAuth = null;
}
