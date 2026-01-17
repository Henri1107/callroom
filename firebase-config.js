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
let firebaseInitialized = false;

function initializeFirebaseServices() {
    try {
        if(!firebase || !firebase.database) {
            console.warn('⚠️ Firebase SDK nicht verfügbar');
            return false;
        }
        
        firebaseDB = firebase.database();
        firebaseAuth = firebase.auth();
        
        // Auch als window Eigenschaft verfügbar machen
        window.firebaseDB = firebaseDB;
        window.firebaseAuth = firebaseAuth;
        
        console.log('✅ Firebase Database und Auth bereit');
        console.log('✅ Database URL:', firebaseConfig.databaseURL);
        console.log('✅ Firebase kann jetzt verwendet werden');
        
        firebaseInitialized = true;
        
        // Starte Benutzer-Listener, wenn app.js geladen ist
        if(window.setupUserListener) {
            console.log('📢 Rufe setupUserListener auf');
            window.setupUserListener();
        } else {
            console.warn('⚠️ setupUserListener noch nicht verfügbar, versuche in 500ms');
        }
        
        return true;
    } catch (error) {
        console.error('❌ Fehler beim Initialisieren von Firebase Services:', error.message);
        return false;
    }
}

// Versuche sofort zu initialisieren
initializeFirebaseServices();

// Fallback: Falls app.js noch nicht geladen ist
document.addEventListener('DOMContentLoaded', () => {
    if(!firebaseInitialized) {
        console.log('⏳ DOMContentLoaded - Versuche Firebase zu initialisieren');
        initializeFirebaseServices();
    }
    
    // Stelle sicher, dass setupUserListener aufgerufen wird
    if(window.setupUserListener && !window.usersListenerActive) {
        setTimeout(() => {
            console.log('📢 Erzwinge setupUserListener Aufruf nach DOMContentLoaded');
            window.setupUserListener();
        }, 100);
    }
});

// Zusätzlicher Fallback bei verzögertem Laden
setTimeout(() => {
    if(!firebaseInitialized) {
        console.log('⏳ 1000ms Timeout - Versuche Firebase zu initialisieren');
        initializeFirebaseServices();
    }
}, 1000);
