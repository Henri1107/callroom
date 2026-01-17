// 1. Service Worker wird von UpUp verwaltet (siehe index.html)
// UpUp bietet automatische Offline-Unterstützung ohne zusätzliche sw.js nötig

// ============================================
// AUTHENTIFIZIERUNG & BENUTZERVERWALTUNG
// ============================================
let currentUser = null;
let isAuthenticated = false;

// Standard Admin-Benutzer
const DEFAULT_ADMIN = {
    username: 'admin',
    password: 'admin'  // In Produktion sollte dies gehashed sein
};

// Alle verfügbaren Navigationstabs
const ALL_TABS = ['home', 'settings', 'overview', 'missing_fencers', 'tableau', 'tableau_input', 'workspace', 'podium', 'sync'];

// Variablen für Firebase-Listener
let usersListenerActive = false;
let firebaseUsersLoaded = false;

// Initialisiere Benutzerdatenbank mit Admin-Benutzer
function initializeUsers() {
    const users = localStorage.getItem('users');
    
    // Stelle sicher, dass Admin-Benutzer immer existiert
    if(!users) {
        const defaultUsers = {
            admin: {
                username: 'admin',
                password: 'admin',
                isAdmin: true,
                permissions: ALL_TABS
            }
        };
        localStorage.setItem('users', JSON.stringify(defaultUsers));
        logger.info('Benutzerdatenbank initialisiert mit Admin-Benutzer (lokal)');
    }
    
    // Versuche Benutzer von Firebase zu laden
    if(firebaseDB && typeof firebaseDB.ref === 'function') {
        logger.info('Lade Benutzer von Firebase beim Start...');
        loadUsersFromFirebaseOnce();
    } else {
        logger.warn('Firebase nicht verfügbar beim Start, verwende lokale Benutzer');
        // Starte einen Timer um später zu versuchen
        setTimeout(() => {
            if(firebaseDB && typeof firebaseDB.ref === 'function' && !firebaseUsersLoaded) {
                logger.info('Firebase ist jetzt verfügbar, lade Benutzer...');
                loadUsersFromFirebaseOnce();
            }
        }, 2000);
    }
}

function getUsers() {
    const users = localStorage.getItem('users');
    return users ? JSON.parse(users) : {};
}


function saveUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
    
    // Synchronisiere mit Firebase
    if(firebaseDB) {
        syncUsersToFirebase(users);
    }
}

function syncUsersToFirebase(users) {
    if(!firebaseDB || typeof firebaseDB.ref !== 'function') {
        logger.warn('⚠️ Firebase nicht initialisiert - Benutzer nicht synchronisiert');
        return Promise.reject('Firebase not ready');
    }
    
    logger.info('📤 Synchronisiere Benutzer zu Firebase:', Object.keys(users).length, 'Benutzer');
    
    return firebaseDB.ref('appData/users').set(users)
        .then(() => {
            logger.info('✅ Benutzer zu Firebase synchronisiert');
            return true;
        })
        .catch(error => {
            logger.error('❌ Fehler beim Synchronisieren der Benutzer:', error.message || error);
            return false;
        });
}

function loadUsersFromFirebaseOnce() {
    if(!firebaseDB || typeof firebaseDB.ref !== 'function') {
        logger.warn('Firebase nicht bereit für Benutzerladen');
        return;
    }
    
    if(firebaseUsersLoaded) {
        logger.info('Benutzer bereits von Firebase geladen');
        return;
    }
    
    logger.info('Starte einmaliges Laden von Benutzern von Firebase...');
    
    try {
        const usersRef = firebaseDB.ref('appData/users');
        const timeout = setTimeout(() => {
            logger.warn('Timeout beim Laden von Firebase Benutzern');
        }, 10000);
        
        usersRef.once('value')
            .then((snapshot) => {
                clearTimeout(timeout);
                if(snapshot.exists()) {
                    const firebaseUsers = snapshot.val();
                    if(firebaseUsers && typeof firebaseUsers === 'object') {
                        localStorage.setItem('users', JSON.stringify(firebaseUsers));
                        firebaseUsersLoaded = true;
                        logger.info('✓ Benutzer von Firebase geladen:', Object.keys(firebaseUsers).length, 'Benutzer');
                        
                        // Starte jetzt den permanenten Listener
                        setupUserListener();
                    } else {
                        logger.warn('Firebase Benutzer-Daten ungültig');
                        firebaseUsersLoaded = true;
                    }
                } else {
                    logger.info('Keine Benutzer in Firebase vorhanden, verwende lokale');
                    const localUsers = getUsers();
                    if(Object.keys(localUsers).length > 0) {
                        logger.info('Synchronisiere lokale Benutzer zu Firebase...');
                        syncUsersToFirebase(localUsers);
                    }
                    firebaseUsersLoaded = true;
                }
            })
            .catch((error) => {
                clearTimeout(timeout);
                logger.error('Fehler beim Laden von Firebase Benutzern:', error.message);
                firebaseUsersLoaded = true;
                // Fallback zu lokalen Benutzern
                logger.info('Verwende lokale Benutzer als Fallback');
            });
    } catch(e) {
        logger.error('Exception beim Firebase Laden:', e.message);
        firebaseUsersLoaded = true;
    }
}

function setupUserListener() {
    if(usersListenerActive || !firebaseDB || typeof firebaseDB.ref !== 'function') {
        if(usersListenerActive) {
            logger.info('Benutzer-Listener ist bereits aktiv');
        } else {
            logger.warn('Firebase nicht verfügbar für Listener');
        }
        return;
    }
    
    usersListenerActive = true;
    logger.info('Starte permanenten Benutzer-Listener in Firebase');
    
    try {
        const usersRef = firebaseDB.ref('appData/users');
        usersRef.on('value', 
            (snapshot) => {
                if(snapshot.exists()) {
                    const firebaseUsers = snapshot.val();
                    if(firebaseUsers && typeof firebaseUsers === 'object') {
                        localStorage.setItem('users', JSON.stringify(firebaseUsers));
                        logger.info('✓ Benutzer von Firebase Listener aktualisiert');
                    }
                } else {
                    logger.info('Keine Benutzer in Firebase vom Listener');
                }
            }, 
            (error) => {
                logger.error('Fehler bei Benutzer-Listener:', error.message);
                usersListenerActive = false;
            }
        );
    } catch(e) {
        logger.error('Exception beim Starten des Listeners:', e.message);
        usersListenerActive = false;
    }
}

// Manuelles Laden von Firebase Benutzern (z.B. bei Anmeldung)
function refreshUsersFromFirebase() {
    if(!firebaseDB) {
        logger.warn('Firebase nicht initialisiert');
        return Promise.reject('Firebase not ready');
    }
    
    return firebaseDB.ref('appData/users').once('value').then((snapshot) => {
        if(snapshot.exists()) {
            const firebaseUsers = snapshot.val();
            localStorage.setItem('users', JSON.stringify(firebaseUsers));
            logger.info('✓ Benutzer von Firebase aktualisiert (manuell)');
            return true;
        } else {
            logger.info('Keine Benutzer in Firebase gefunden');
            return false;
        }
    }).catch(error => {
        logger.error('Fehler beim Laden von Benutzern:', error);
        return false;
    });
}

function authenticateUser(username, password) {
    // Zuerst versuchen, aktuellste Benutzer von Firebase zu laden
    return refreshUsersFromFirebase().then(() => {
        const users = getUsers();
        const user = users[username];
        
        if(user && user.password === password) {
            currentUser = {
                username: user.username,
                isAdmin: user.isAdmin || false,
                permissions: user.permissions || []
            };
            isAuthenticated = true;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            logger.info('✓ Benutzer authentifiziert:', username);
            return true;
        }
        
        logger.warn('❌ Authentifizierungsfehler für Benutzer:', username);
        return false;
    }).catch(error => {
        logger.error('Fehler beim Authentifizierungsprozess:', error);
        // Fallback: Versuche mit lokalen Benutzern
        const users = getUsers();
        const user = users[username];
        
        if(user && user.password === password) {
            currentUser = {
                username: user.username,
                isAdmin: user.isAdmin || false,
                permissions: user.permissions || []
            };
            isAuthenticated = true;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            logger.info('✓ Benutzer authentifiziert (Fallback):', username);
            return true;
        }
        
        return false;
    });
}

function logoutUser() {
    currentUser = null;
    isAuthenticated = false;
    localStorage.removeItem('currentUser');
    logger.info('Benutzer abgemeldet');
}

function restoreSession() {
    const savedUser = localStorage.getItem('currentUser');
    if(savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            isAuthenticated = true;
            logger.info('Session wiederhergestellt für:', currentUser.username);
            return true;
        } catch(e) {
            logger.error('Fehler beim Wiederherstellen der Session:', e);
            return false;
        }
    }
    return false;
}

function createUser(username, password, permissions = []) {
    const users = getUsers();
    
    if(users[username]) {
        logger.warn('❌ Benutzer existiert bereits:', username);
        return false;
    }
    
    users[username] = {
        username: username,
        password: password,
        isAdmin: false,
        permissions: permissions
    };
    
    saveUsers(users);
    logger.info('✅ Neuer Benutzer erstellt:', username);
    
    // Synchronisiere gesamte Benutzerliste zu Firebase
    syncUsersToFirebase(users)
        .then(() => logger.info('📤 Benutzer', username, 'zu Firebase synchronisiert'))
        .catch(error => logger.error('❌ Fehler beim Synchronisieren des Benutzers:', username, error));
    
    return true;
}

function deleteUser(username) {
    const users = getUsers();
    
    if(username === 'admin') {
        logger.warn('Admin-Benutzer kann nicht gelöscht werden');
        return false;
    }
    
    if(users[username]) {
        delete users[username];
        saveUsers(users);
        logger.info('Benutzer gelöscht:', username);
        
        // Entferne Benutzer auch aus Firebase
        if(firebaseDB) {
            firebaseDB.ref(`appData/users/${username}`).remove()
                .catch(error => logger.error('Fehler beim Löschen des Benutzers in Firebase:', error));
        }
        
        return true;
    }
    
    return false;
}

function updateUserPermissions(username, permissions) {
    const users = getUsers();
    
    if(users[username]) {
        users[username].permissions = permissions;
        saveUsers(users);
        logger.info('Berechtigungen aktualisiert für:', username);
        
        // Synchronisiere aktualisierte Berechtigungen zu Firebase
        if(firebaseDB) {
            firebaseDB.ref(`appData/users/${username}/permissions`).set(permissions)
                .catch(error => logger.error('Fehler beim Synchronisieren der Berechtigungen:', error));
        }
        
        return true;
    }
    
    return false;
}

// Firebase Sync Flag
let firebaseSyncEnabled = false;
let currentEventId = null;
// Callroom state: current Durchgang (group of 4 matches)
let callroomGroupIndex = 0;
// Which round is shown in the Callroom (0-based)
let callroomRoundIndex = 0;

// 2. Fencers-Datenbank laden
let fencersDB = {};
let koTreeState = null;

// 3. Offline Status Überwachung
let isOffline = !navigator.onLine;

function updateOfflineIndicator() {
    const offlineIndicator = document.getElementById('offline-indicator');
    if (!offlineIndicator) return;
    
    if (!navigator.onLine) {
        offlineIndicator.style.display = 'inline-block';
        isOffline = true;
    } else {
        offlineIndicator.style.display = 'none';
        isOffline = false;
    }
}

// Event Listener für Online/Offline Status
window.addEventListener('online', () => {
    logger.info('App ist wieder online');
    updateOfflineIndicator();
});

window.addEventListener('offline', () => {
    logger.warn('App ist offline - Service Worker wird verwendet');
    updateOfflineIndicator();
});

// Simple logging utility (timestamps + optional storage)
const logBuffer = [];
const MAX_LOG_BUFFER = 500;
const logger = {
    push(level, args) {
        const ts = new Date().toISOString();
        const msg = [ts, level].concat(Array.from(args));
        // write to console
        if(level === 'ERROR') console.error.apply(console, msg);
        else if(level === 'WARN') console.warn.apply(console, msg);
        else console.log.apply(console, msg);

        // store in buffer
        logBuffer.push({ts, level, message: args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')});
        if(logBuffer.length > MAX_LOG_BUFFER) logBuffer.shift();

        // Auto-persist errors to localStorage (per event)
        try {
            if(level === 'ERROR') {
                const keyName = 'appLogs_' + (currentEventId || 'local');
                this.persist(keyName);
            }
        } catch(e) { /* ignore persistence errors */ }
    },
    info(...args) { this.push('INFO', args); },
    warn(...args) { this.push('WARN', args); },
    error(...args) { this.push('ERROR', args); },
    dump() { return logBuffer.slice(); },
    persist(key='appLogs') { try { localStorage.setItem(key, JSON.stringify(logBuffer)); } catch(e) { /* ignore */ } }
};

async function loadFencersDatabase() {
    try {
        const response = await fetch('./fencers.xml');
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        const fencers = xmlDoc.getElementsByTagName('Tireur');
        for(let i = 0; i < fencers.length; i++) {
            const f = fencers[i];
            const id = f.getAttribute('ID');
            fencersDB[id] = {
                id: id,
                prenom: f.getAttribute('Prenom'),
                nom: f.getAttribute('Nom'),
                nation: f.getAttribute('Nation')
            };
        }
        logger.info('Fechter-Datenbank geladen:', Object.keys(fencersDB).length, 'Fechter');
    } catch(e) {
        logger.error('Fehler beim Laden der Fechter-Datenbank:', e);
    }
}

function getFencerById(id) {
    return fencersDB[id] || null;
}

function getFencerDisplay(fencer) {
    if(!fencer) return '—';
    return `${fencer.prenom} ${fencer.nom} (${fencer.nation})`;
}

// 3. Modus-Management (Einzel/Team)
let currentMode = localStorage.getItem('tableauMode') || 'einzel';

function setTableauMode(mode) {
    currentMode = mode;
    localStorage.setItem('tableauMode', mode);
    logger.info('Modus geändert zu:', mode);
}

function getTableauMode() {
    return currentMode;
}

// ============================================
// BAHN-VERWALTUNG (5 Bahnen)
// ============================================
const defaultLaneColors = ['#FF0000', '#0000FF', '#FFFF00', '#00FF00', '#FF00FF'];
const defaultLaneNames = ['Bahn 1', 'Bahn 2', 'Bahn 3', 'Bahn 4', 'Bahn 5'];

// Manuelle Auswahl verwendet die gleichen Bahnen
const manualLaneColors = defaultLaneColors;
const manualLaneNames = defaultLaneNames;

function getLaneColors() {
    const saved = localStorage.getItem('laneColors');
    if(saved) {
        try {
            const colors = JSON.parse(saved);
            return (colors && colors.length === 5) ? colors : defaultLaneColors;
        } catch(e) {
            return defaultLaneColors;
        }
    }
    return defaultLaneColors;
}

function setLaneColors(colors) {
    localStorage.setItem('laneColors', JSON.stringify(colors));
    logger.info('Bahnfarben gespeichert:', colors);
    if(firebaseSyncEnabled && currentEventId && firebaseDB) {
        syncLaneColorsToFirebase(colors);
    }
}

function getLaneNames() {
    const saved = localStorage.getItem('laneNames');
    if(saved) {
        try {
            const names = JSON.parse(saved);
            return (names && names.length === 5) ? names : defaultLaneNames;
        } catch(e) {
            return defaultLaneNames;
        }
    }
    return defaultLaneNames;
}

function setLaneNames(names) {
    localStorage.setItem('laneNames', JSON.stringify(names));
    logger.info('Bahnnamen gespeichert:', names);
    if(firebaseSyncEnabled && currentEventId && firebaseDB) {
        syncLaneNamesToFirebase(names);
    }
}

// ============================================
// FIREBASE SYNCHRONISIERUNGS-FUNKTIONEN
// ============================================

function initializeFirebaseSync(eventId) {
    if(!firebaseDB) {
        logger.error('Firebase nicht initialisiert');
        return false;
    }
    
    currentEventId = eventId;
    firebaseSyncEnabled = true;
    logger.info('Firebase Sync aktiviert für Event:', eventId);
    
    // Höre auf Änderungen am KO-Baum
    const treeRef = firebaseDB.ref(`events/${eventId}/koTree`);
    treeRef.on('value', (snapshot) => {
        if(snapshot.exists()) {
            const data = snapshot.val();
            koTreeState = data;
            logger.info('✓ KO-Baum von Firebase aktualisiert');
            // Aktualisiere alle Anzeigen
            if(document.getElementById('tableau-content')) {
                document.getElementById('tableau-content').innerHTML = renderKOTree(koTreeState);
            }
            try { renderCallroomOverview(); } catch(e) {}
        } else {
            logger.warn('Keine KO-Baum-Daten in Firebase für Event:', eventId);
        }
    }, (error) => {
        logger.error('Fehler beim Laden KO-Baum:', error);
    });
    
    // Höre auf Änderungen an Bahnfarben
    const colorsRef = firebaseDB.ref(`events/${eventId}/laneColors`);
    colorsRef.on('value', (snapshot) => {
        if(snapshot.exists()) {
            const colors = snapshot.val();
            localStorage.setItem('laneColors', JSON.stringify(colors));
            logger.info('✓ Bahnfarben von Firebase aktualisiert');
            if(document.getElementById('tableau-content')) {
                document.getElementById('tableau-content').innerHTML = renderKOTree(koTreeState);
            }
            try { renderCallroomOverview(); } catch(e) {}
        }
    });
    
    // Höre auf Änderungen an Bahnnamen
    const namesRef = firebaseDB.ref(`events/${eventId}/laneNames`);
    namesRef.on('value', (snapshot) => {
        if(snapshot.exists()) {
            const names = snapshot.val();
            localStorage.setItem('laneNames', JSON.stringify(names));
            logger.info('✓ Bahnnamen von Firebase aktualisiert');
            if(document.getElementById('tableau-content')) {
                document.getElementById('tableau-content').innerHTML = renderKOTree(koTreeState);
            }
            try { renderCallroomOverview(); } catch(e) {}
        }
    });

    // Höre auf Änderungen an Callroom-Status (synchronisiert Abwesend/Anwesend/kontrolliert)
    const statusesRef = firebaseDB.ref(`events/${eventId}/callroomStatuses`);
    statusesRef.on('value', (snapshot) => {
        if(snapshot.exists()) {
            const statuses = snapshot.val();
            localStorage.setItem(`callroomStatuses_${eventId}`, JSON.stringify(statuses));
            logger.info('✓ Callroom-Status von Firebase aktualisiert');
            try { renderCallroomOverview(); } catch(e) {}
        }
    });
    
    return true;
}

function syncKOTreeToFirebase(koTree) {
    if(!currentEventId) {
        logger.warn('syncKOTreeToFirebase: Keine Event ID');
        return;
    }
    if(!firebaseDB) {
        logger.warn('syncKOTreeToFirebase: Firebase nicht initialisiert');
        return;
    }
    if(!firebaseSyncEnabled) {
        logger.warn('syncKOTreeToFirebase: Firebase Sync nicht aktiviert');
        return;
    }
    
    logger.info('Speichere KO-Baum zu Firebase:', currentEventId);
    firebaseDB.ref(`events/${currentEventId}/koTree`).set(koTree)
        .then(() => logger.info('✓ KO-Baum zu Firebase synchronisiert'))
        .catch(error => logger.error('✗ Fehler beim Synchronisieren des KO-Baums:', error));
}

function syncCallroomStatusesToFirebase(statuses) {
    if(!currentEventId) {
        logger.warn('syncCallroomStatusesToFirebase: Keine Event ID');
        return;
    }
    if(!firebaseDB) {
        logger.warn('syncCallroomStatusesToFirebase: Firebase nicht initialisiert');
        return;
    }
    if(!firebaseSyncEnabled) {
        logger.warn('syncCallroomStatusesToFirebase: Firebase Sync nicht aktiviert');
        return;
    }
    
    logger.info('Speichere Callroom-Status zu Firebase:', currentEventId);
    firebaseDB.ref(`events/${currentEventId}/callroomStatuses`).set(statuses)
        .then(() => logger.info('✓ Callroom-Status zu Firebase synchronisiert'))
        .catch(error => logger.error('✗ Fehler beim Synchronisieren des Callroom-Status:', error));
}

function syncLaneColorsToFirebase(colors) {
    if(!currentEventId) {
        logger.warn('syncLaneColorsToFirebase: Keine Event ID');
        return;
    }
    if(!firebaseDB) {
        logger.warn('syncLaneColorsToFirebase: Firebase nicht initialisiert');
        return;
    }
    if(!firebaseSyncEnabled) {
        logger.warn('syncLaneColorsToFirebase: Firebase Sync nicht aktiviert');
        return;
    }
    
    logger.info('Speichere Bahnfarben zu Firebase:', currentEventId);
    firebaseDB.ref(`events/${currentEventId}/laneColors`).set(colors)
        .then(() => logger.info('✓ Bahnfarben zu Firebase synchronisiert'))
        .catch(error => logger.error('✗ Fehler beim Synchronisieren der Bahnfarben:', error));
}

function syncLaneNamesToFirebase(names) {
    if(!currentEventId) {
        logger.warn('syncLaneNamesToFirebase: Keine Event ID');
        return;
    }
    if(!firebaseDB) {
        logger.warn('syncLaneNamesToFirebase: Firebase nicht initialisiert');
        return;
    }
    if(!firebaseSyncEnabled) {
        logger.warn('syncLaneNamesToFirebase: Firebase Sync nicht aktiviert');
        return;
    }
    
    logger.info('Speichere Bahnnamen zu Firebase:', currentEventId);
    firebaseDB.ref(`events/${currentEventId}/laneNames`).set(names)
        .then(() => logger.info('✓ Bahnnamen zu Firebase synchronisiert'))
        .catch(error => logger.error('✗ Fehler beim Synchronisieren der Bahnnamen:', error));
}

function syncTableauValuesToFirebase(values, mode) {
    if(!currentEventId) {
        logger.warn('syncTableauValuesToFirebase: Keine Event ID');
        return;
    }
    if(!firebaseDB) {
        logger.warn('syncTableauValuesToFirebase: Firebase nicht initialisiert');
        return;
    }
    if(!firebaseSyncEnabled) {
        logger.warn('syncTableauValuesToFirebase: Firebase Sync nicht aktiviert');
        return;
    }
    
    logger.info('Speichere Tableauwerte zu Firebase:', currentEventId);
    firebaseDB.ref(`events/${currentEventId}/tableauData`).set({
        values: values,
        mode: mode,
        timestamp: new Date().toISOString()
    })
        .then(() => logger.info('✓ Tableauwerte zu Firebase synchronisiert'))
        .catch(error => logger.error('✗ Fehler beim Synchronisieren der Tableauwerte:', error));
}

function getLaneForMatch(match, mode) {
    // Berechne welche Bahn für dieses Gefecht
    // Im 64er KO: 8 Gefechte pro Bahn (32 Gefechte / 4 Bahnen)
    // Im 16er KO: 2 Gefechte pro Bahn (8 Gefechte / 4 Bahnen)
    const matchesPerLane = mode === 'einzel' ? 8 : 2;
    return Math.floor(match / matchesPerLane);
}

// 4. KO-Baum Generator
function generateKOTree(participants, mode) {
    const tree = {
        totalRounds: Math.ceil(Math.log2(participants)),
        rounds: [],
        consolationRounds: [],
        mode: mode
    };
    
    // Initialisiere alle Runden des Hauptturniers
    for(let round = 0; round < tree.totalRounds; round++) {
        const matchesInRound = Math.pow(2, tree.totalRounds - round - 1);
        tree.rounds[round] = [];
        for(let match = 0; match < matchesInRound; match++) {
            tree.rounds[round].push({
                id: `round-${round}-match-${match}`,
                p1: null,
                p2: null,
                winner: null,
                laneOverride: null  // Für manuelle Bahnänderung
            });
        }
    }
    
    // Für 16er KO: Hinzufügen von Platzierungsgefechten ab 8er KO
    if(mode === 'team' && participants === 16) {
        // 3./4. Platz (8er KO Verlierer vs andere Verlierer)
        tree.consolationRounds.push({
            title: '3./4. Platz',
            matches: [{
                id: 'consolation-0-0',
                p1: null,
                p2: null,
                winner: null,
                laneOverride: null
            }]
        });
        // 5./6. Platz
        tree.consolationRounds.push({
            title: '5./6. Platz',
            matches: [{
                id: 'consolation-1-0',
                p1: null,
                p2: null,
                winner: null,
                laneOverride: null
            }, {
                id: 'consolation-1-1',
                p1: null,
                p2: null,
                winner: null,
                laneOverride: null
            }]
        });
        // 7./8. Platz
        tree.consolationRounds.push({
            title: '7./8. Platz',
            matches: [{
                id: 'consolation-2-0',
                p1: null,
                p2: null,
                winner: null,
                laneOverride: null
            }, {
                id: 'consolation-2-1',
                p1: null,
                p2: null,
                winner: null,
                laneOverride: null
            }, {
                id: 'consolation-2-2',
                p1: null,
                p2: null,
                winner: null,
                laneOverride: null
            }, {
                id: 'consolation-2-3',
                p1: null,
                p2: null,
                winner: null,
                laneOverride: null
            }]
        });
    }
    
    return tree;
}

function populateKOTreeFirstRound(koTree, fencerIds, mode) {
    // Erste Runde: 1vs64, 2vs63, ... (bei Einzel) oder 1vs16, 2vs15, ... (bei Team)
    const matchCount = mode === 'einzel' ? 32 : 8;
    
    for(let match = 0; match < matchCount; match++) {
        const idx1 = match;
        const idx2 = fencerIds.length - 1 - match;
        
        const fencer1 = getFencerById(fencerIds[idx1]);
        const fencer2 = getFencerById(fencerIds[idx2]);
        
        koTree.rounds[0][match].p1 = fencer1;
        koTree.rounds[0][match].p2 = fencer2;
    }
}

function renderKOTree(koTree) {
    const mode = getTableauMode();
    const laneColors = getLaneColors();
    const laneNames = getLaneNames();
    
    let html = '<div class="ko-tree-container">';
    
    // ===== HAUPTTURNIER =====
    html += '<div class="ko-tournament-section">';
    for(let round = 0; round < koTree.rounds.length; round++) {
        html += `<div class="ko-round">`;
        
        // Berechne KO-Größe für diese Runde
        const remainingFencers = Math.pow(2, koTree.totalRounds - round);
        let koSizeLabel;
        if(remainingFencers === 2) koSizeLabel = 'Finale';
        else if(remainingFencers === 4) koSizeLabel = 'Halbfinale';
        else koSizeLabel = `${remainingFencers}er KO`;
        html += `<div class="round-title">${koSizeLabel}</div>`;
        
        // Berechne Matches pro Bahn: verteile alle Matches dieser Runde auf 4 Bahnen
        const matchesInRound = koTree.rounds[round].length;
        const matchesPerBahn = Math.ceil(matchesInRound / 4);
        
        for(let match = 0; match < matchesInRound; match++) {
            const matchData = koTree.rounds[round][match];
            
            // Bestimme Bahn für dieses Match
            let laneIdx = 0;
            if(matchData.laneOverride !== null && matchData.laneOverride !== undefined) {
                // Manuelle Bahnzuweisung nutzen (jetzt auch Bahn 5 möglich)
                laneIdx = Math.min(matchData.laneOverride, manualLaneColors.length - 1);
                const laneColor = manualLaneColors[laneIdx];
                const laneName = manualLaneNames[laneIdx];
                const matchStyle = `style="border-left: 5px solid ${laneColor};"`;
                
                html += `
                    <div class="ko-match" data-round="${round}" data-match="${match}" ${matchStyle}>
                        <div class="ko-lane-label" style="background-color: ${laneColor}; cursor: pointer;" onclick="showLaneSelector('main', ${round}, ${match})" title="Klick um Bahn zu ändern">${laneName}</div>
                        <div class="ko-player" data-player="1" style="cursor: pointer; user-select: none;" onclick="selectWinner(${round}, ${match}, 1)">
                            ${matchData.p1 ? getFencerDisplay(matchData.p1) : '—'}
                        </div>
                        <div class="ko-vs">vs</div>
                        <div class="ko-player" data-player="2" style="cursor: pointer; user-select: none;" onclick="selectWinner(${round}, ${match}, 2)">
                            ${matchData.p2 ? getFencerDisplay(matchData.p2) : '—'}
                        </div>
                        ${matchData.winner ? `
                            <div class="ko-winner-wrapper">
                                <div class="ko-winner">✓ ${getFencerDisplay(matchData.winner)}</div>
                                <button class="ko-clear-btn" onclick="clearWinner(${round}, ${match})" title="Sieger entfernen">×</button>
                            </div>
                        ` : ''}
                    </div>
                `;
            } else {
                // Automatisch: Berechne Bahn basierend auf Match-Position
                laneIdx = Math.floor(match / matchesPerBahn);
                laneIdx = Math.min(laneIdx, 3); // Maximal Bahn 3 (Index 0-3)
                const laneColor = laneColors[laneIdx];
                const laneName = laneNames[laneIdx];
                const matchStyle = `style="border-left: 5px solid ${laneColor};"`;
                
                html += `
                    <div class="ko-match" data-round="${round}" data-match="${match}" ${matchStyle}>
                        <div class="ko-lane-label" style="background-color: ${laneColor}; cursor: pointer;" onclick="showLaneSelector('main', ${round}, ${match})" title="Klick um Bahn zu ändern">${laneName}</div>
                        <div class="ko-player" data-player="1" style="cursor: pointer; user-select: none;" onclick="selectWinner(${round}, ${match}, 1)">
                            ${matchData.p1 ? getFencerDisplay(matchData.p1) : '—'}
                        </div>
                        <div class="ko-vs">vs</div>
                        <div class="ko-player" data-player="2" style="cursor: pointer; user-select: none;" onclick="selectWinner(${round}, ${match}, 2)">
                            ${matchData.p2 ? getFencerDisplay(matchData.p2) : '—'}
                        </div>
                        ${matchData.winner ? `
                            <div class="ko-winner-wrapper">
                                <div class="ko-winner">✓ ${getFencerDisplay(matchData.winner)}</div>
                                <button class="ko-clear-btn" onclick="clearWinner(${round}, ${match})" title="Sieger entfernen">×</button>
                            </div>
                        ` : ''}
                    </div>
                `;
            }
        }
        html += `</div>`;
    }
    html += '</div>';
    
    // ===== PLATZIERUNGSGEFECHTE (3./4., 5./6., 7./8. Platz) =====
    if(koTree.consolationRounds && koTree.consolationRounds.length > 0) {
        html += '<div class="ko-tournament-section">';
        for(let consolationIdx = 0; consolationIdx < koTree.consolationRounds.length; consolationIdx++) {
            const consolationRound = koTree.consolationRounds[consolationIdx];
            html += `<div class="ko-round">`;
            html += `<div class="round-title">${consolationRound.title}</div>`;
            
            // Verteile Platzierungsgefechte zyklisch auf Bahnen
            for(let match = 0; match < consolationRound.matches.length; match++) {
                const matchData = consolationRound.matches[match];
                
                let laneIdx = 0;
                if(matchData.laneOverride !== null && matchData.laneOverride !== undefined) {
                    laneIdx = Math.min(matchData.laneOverride, 3);
                } else {
                    // Zyklisch auf die 4 Bahnen verteilen
                    laneIdx = (consolationIdx * 2 + match) % 4;
                }
                
                const laneColor = laneColors[laneIdx];
                const laneName = laneNames[laneIdx];
                const matchStyle = `style="border-left: 5px solid ${laneColor};"`;
                
                html += `
                    <div class="ko-match" data-consolation="${consolationIdx}" data-match="${match}" ${matchStyle}>
                        <div class="ko-lane-label" style="background-color: ${laneColor}; cursor: pointer;" onclick="showLaneSelector('consolation', ${consolationIdx}, ${match})" title="Klick um Bahn zu ändern">${laneName}</div>
                        <div class="ko-player" data-player="1" style="cursor: pointer; user-select: none;" onclick="selectConsolationWinner(${consolationIdx}, ${match}, 1)">
                            ${matchData.p1 ? getFencerDisplay(matchData.p1) : '—'}
                        </div>
                        <div class="ko-vs">vs</div>
                        <div class="ko-player" data-player="2" style="cursor: pointer; user-select: none;" onclick="selectConsolationWinner(${consolationIdx}, ${match}, 2)">
                            ${matchData.p2 ? getFencerDisplay(matchData.p2) : '—'}
                        </div>
                        ${matchData.winner ? `
                            <div class="ko-winner-wrapper">
                                <div class="ko-winner">✓ ${getFencerDisplay(matchData.winner)}</div>
                                <button class="ko-clear-btn" onclick="clearConsolationWinner(${consolationIdx}, ${match})" title="Sieger entfernen">×</button>
                            </div>
                        ` : ''}
                    </div>
                `;
            }
            html += `</div>`;
        }
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

// Ersetzt die showLaneSelector-Funktion, damit 5 Bahnen auswählbar sind
function showLaneSelector(type, roundOrConsolation, match) {
    const laneColors = manualLaneColors;
    const laneNames = manualLaneNames;
    let options = '';
    for(let i = 0; i < laneColors.length; i++) {
        options += `<option value="${i}">${laneNames[i]} (${laneColors[i]})</option>`;
    }
    const selectHtml = `
        <div id="laneSelector" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); z-index: 1000;">
            <h3>Wähle eine Bahn:</h3>
            <select id="laneSelectDropdown" onchange="changeLaneForMatch('${type}', ${roundOrConsolation}, ${match}, this.value)">
                <option value="-1">Automatische Zuweisung</option>
                ${options}
            </select>
            <button onclick="document.getElementById('laneSelector').remove()" style="margin-left: 10px;">Schließen</button>
        </div>
    `;
    // Entferne alten Selector falls noch vorhanden
    const oldSelector = document.getElementById('laneSelector');
    if(oldSelector) oldSelector.remove();
    document.body.insertAdjacentHTML('beforeend', selectHtml);
}

function changeLaneForMatch(type, roundOrConsolation, match, laneValue) {
    if(!koTreeState) return;
    
    const laneIdx = parseInt(laneValue);
    
    if(type === 'main') {
        koTreeState.rounds[roundOrConsolation][match].laneOverride = laneIdx === -1 ? null : laneIdx;
    } else if(type === 'consolation') {
        koTreeState.consolationRounds[roundOrConsolation].matches[match].laneOverride = laneIdx === -1 ? null : laneIdx;
    }
    
    refreshTableauDisplay();
    
    // Sync zu Firebase
    if(firebaseSyncEnabled && currentEventId && firebaseDB) {
        syncKOTreeToFirebase(koTreeState);
    }
    
    document.getElementById('laneSelector').remove();
}

let longPressTimer = null;
let longPressData = null;

function selectWinner(round, match, playerNum) {
    if(!koTreeState) return;
    
    const matchData = koTreeState.rounds[round][match];
    const fencer = playerNum === 1 ? matchData.p1 : matchData.p2;
    
    if(!fencer) return;
    
    // Wenn bereits ein Sieger gesetzt ist und man klickt auf den gleichen Spieler, passiert nichts
    if(matchData.winner && matchData.winner.id === fencer.id) {
        return;
    }
    
    // Setze neuen Sieger (auch wenn bereits einer existiert)
    koTreeState.rounds[round][match].winner = fencer;
    
    // Propagiere Sieger in nächste Runde
    if(round + 1 < koTreeState.rounds.length) {
        const nextMatchIdx = Math.floor(match / 2);
        const playerInNextMatch = (match % 2) + 1;
        
        if(playerInNextMatch === 1) {
            koTreeState.rounds[round + 1][nextMatchIdx].p1 = fencer;
        } else {
            koTreeState.rounds[round + 1][nextMatchIdx].p2 = fencer;
        }
    }
    
    refreshTableauDisplay();
    
    // Sync zu Firebase
    if(firebaseSyncEnabled && currentEventId && firebaseDB) {
        syncKOTreeToFirebase(koTreeState);
    }
}

function clearWinner(round, match) {
    if(!koTreeState) return;
    
    const fencerToRemove = koTreeState.rounds[round][match].winner;
    
    // Entferne Sieger aus aktueller Runde
    koTreeState.rounds[round][match].winner = null;
    
    // Entferne diesen Fechter aus allen folgenden Runden
    if(fencerToRemove) {
        for(let r = round + 1; r < koTreeState.rounds.length; r++) {
            for(let m = 0; m < koTreeState.rounds[r].length; m++) {
                const matchData = koTreeState.rounds[r][m];
                
                // Wenn dieser Fechter in p1 oder p2 eingetragen ist, entferne ihn
                if(matchData.p1 && matchData.p1.id === fencerToRemove.id) {
                    matchData.p1 = null;
                }
                if(matchData.p2 && matchData.p2.id === fencerToRemove.id) {
                    matchData.p2 = null;
                }
                
                // Entferne auch den Sieg wenn dieser Fechter Sieger war
                if(matchData.winner && matchData.winner.id === fencerToRemove.id) {
                    matchData.winner = null;
                }
            }
        }
    }
    
    refreshTableauDisplay();
    
    // Sync zu Firebase
    if(firebaseSyncEnabled && currentEventId && firebaseDB) {
        syncKOTreeToFirebase(koTreeState);
    }
}

function selectConsolationWinner(consolationIdx, match, playerNum) {
    if(!koTreeState || !koTreeState.consolationRounds || !koTreeState.consolationRounds[consolationIdx]) return;
    
    const matchData = koTreeState.consolationRounds[consolationIdx].matches[match];
    const fencer = playerNum === 1 ? matchData.p1 : matchData.p2;
    
    if(!fencer) return;
    
    // Wenn bereits ein Sieger gesetzt ist und man klickt auf den gleichen Spieler, passiert nichts
    if(matchData.winner && matchData.winner.id === fencer.id) {
        return;
    }
    
    // Setze neuen Sieger
    koTreeState.consolationRounds[consolationIdx].matches[match].winner = fencer;
    
    // Propagiere Sieger in nächste Consolation Runde falls vorhanden
    if(consolationIdx + 1 < koTreeState.consolationRounds.length) {
        const nextMatchIdx = Math.floor(match / 2);
        const playerInNextMatch = (match % 2) + 1;
        
        if(nextMatchIdx < koTreeState.consolationRounds[consolationIdx + 1].matches.length) {
            if(playerInNextMatch === 1) {
                koTreeState.consolationRounds[consolationIdx + 1].matches[nextMatchIdx].p1 = fencer;
            } else {
                koTreeState.consolationRounds[consolationIdx + 1].matches[nextMatchIdx].p2 = fencer;
            }
        }
    }
    
    refreshTableauDisplay();
    
    // Sync zu Firebase
    if(firebaseSyncEnabled && currentEventId && firebaseDB) {
        syncKOTreeToFirebase(koTreeState);
    }
}

function clearConsolationWinner(consolationIdx, match) {
    if(!koTreeState || !koTreeState.consolationRounds || !koTreeState.consolationRounds[consolationIdx]) return;
    
    const fencerToRemove = koTreeState.consolationRounds[consolationIdx].matches[match].winner;
    
    // Entferne Sieger aus aktueller Runde
    koTreeState.consolationRounds[consolationIdx].matches[match].winner = null;
    
    // Entferne diesen Fechter aus allen folgenden Consolation Runden
    if(fencerToRemove) {
        for(let c = consolationIdx + 1; c < koTreeState.consolationRounds.length; c++) {
            for(let m = 0; m < koTreeState.consolationRounds[c].matches.length; m++) {
                const matchData = koTreeState.consolationRounds[c].matches[m];
                
                if(matchData.p1 && matchData.p1.id === fencerToRemove.id) {
                    matchData.p1 = null;
                }
                if(matchData.p2 && matchData.p2.id === fencerToRemove.id) {
                    matchData.p2 = null;
                }
                
                if(matchData.winner && matchData.winner.id === fencerToRemove.id) {
                    matchData.winner = null;
                }
            }
        }
    }
    
    refreshTableauDisplay();
    
    // Sync zu Firebase
    if(firebaseSyncEnabled && currentEventId && firebaseDB) {
        syncKOTreeToFirebase(koTreeState);
    }
}

function refreshTableauDisplay() {
    const contentDiv = document.getElementById('tableau-content');
    if(contentDiv && koTreeState) {
        const mode = getTableauMode();
        const modeLabel = mode === 'einzel' ? '64er KO-Baum' : '16er KO-Baum';
        contentDiv.innerHTML = `<h2>${modeLabel}</h2>` + renderKOTree(koTreeState);
    }
}

// =============================
// Callroom Übersicht (Durchgänge)
// =============================

const CALLER_STATUSES = ['Abwesend','Anwesend','kontrolliert'];

function getCallroomStatuses() {
    const key = `callroomStatuses_${currentEventId || 'local'}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
}

function saveCallroomStatuses(obj) {
    const key = `callroomStatuses_${currentEventId || 'local'}`;
    localStorage.setItem(key, JSON.stringify(obj));
}

function renderCallroomOverview() {
    const container = document.getElementById('callroom-overview');
    if(!container) return;

    if(!koTreeState || !koTreeState.rounds || koTreeState.rounds.length === 0) {
        container.innerHTML = '<p>Kein Turnier geladen. Bitte erstelle ein Tableau.</p>';
        const lbl = document.getElementById('callroom-label'); if(lbl) lbl.textContent = 'Durchgang 0 / 0';
        return;
    }
    // Ermitteln, welche Runde aktuell angezeigt werden soll
    const totalRounds = koTreeState.rounds.length;
    if(callroomRoundIndex >= totalRounds) callroomRoundIndex = totalRounds - 1;
    if(callroomRoundIndex < 0) callroomRoundIndex = 0;
    const matches = koTreeState.rounds[callroomRoundIndex] || [];
    const groups = [];
    for(let i = 0; i < matches.length; i += 4) {
        groups.push(matches.slice(i, i + 4));
    }

    if(callroomGroupIndex >= groups.length) callroomGroupIndex = groups.length - 1;
    if(callroomGroupIndex < 0) callroomGroupIndex = 0;

    const currentGroup = groups[callroomGroupIndex] || [];
    const statuses = getCallroomStatuses();

    // Update label
    const label = document.getElementById('callroom-label');
    if(label) label.textContent = `Durchgang ${callroomGroupIndex + 1} / ${Math.max(1, groups.length)}`;

    // Update round select options (use KO size label)
    const roundSelect = document.getElementById('callroom-round-select');
    if(roundSelect) {
        // repopulate
        let opts = '';
        for(let r = 0; r < totalRounds; r++) {
            const remainingFencers = Math.pow(2, totalRounds - r);
            let koSizeLabel;
            if(remainingFencers === 2) koSizeLabel = 'Finale';
            else if(remainingFencers === 4) koSizeLabel = 'Halbfinale';
            else koSizeLabel = `${remainingFencers}er KO`;
            opts += `<option value="${r}">${koSizeLabel}</option>`;
        }
        roundSelect.innerHTML = opts;
        roundSelect.value = String(callroomRoundIndex);
        roundSelect.onchange = function(e) { setCallroomRound(parseInt(this.value,10)); };
    }

    // Render lanes horizontally
    let html = '<div class="callroom-row">';
    const laneColors = getLaneColors();
    for(let lane = 0; lane < 4; lane++) {
        const matchData = currentGroup[lane];
        if(!matchData) {
            html += `<div class="callroom-lane empty-lane">--</div>`;
            continue;
        }

        const matchIndex = (callroomGroupIndex * 4) + lane;
        const p1 = matchData.p1;
        const p2 = matchData.p2;

        const statusKey = matchData.id || `m_${matchIndex}`;
        const s1 = (statuses[statusKey] && statuses[statusKey].p1) || 'Abwesend';
        const s2 = (statuses[statusKey] && statuses[statusKey].p2) || 'Abwesend';

        // Farben für Status: Abwesend=rot, Anwesend=gelb, kontrolliert=grün
        const statusColors = {'Abwesend': '#ff4444', 'Anwesend': '#ffdd44', 'kontrolliert': '#44dd44'};
        const bgColor1 = statusColors[s1] || '#fff';
        const bgColor2 = statusColors[s2] || '#fff';
        const laneColor = laneColors[lane] || '#5bd2fe';

        html += `
            <div class="callroom-lane" data-match-index="${matchIndex}">
                <div class="lane-header" style="background-color: ${laneColor};">${getLaneNames()[lane] || ('Bahn ' + (lane+1))}</div>
                <div class="callroom-fencers">
                    <div class="callroom-fencer" style="background-color: ${bgColor1};" onclick="toggleFencerStatus(${matchIndex}, 1)">
                        <div class="fencer-name">${p1 ? getFencerDisplay(p1) : '—'}</div>
                        <div class="fencer-status">${s1}</div>
                    </div>
                    <div class="callroom-swap">
                        <button onclick="swapSides(${matchIndex}); event.stopPropagation();">⇄</button>
                    </div>
                    <div class="callroom-fencer" style="background-color: ${bgColor2};" onclick="toggleFencerStatus(${matchIndex}, 2)">
                        <div class="fencer-name">${p2 ? getFencerDisplay(p2) : '—'}</div>
                        <div class="fencer-status">${s2}</div>
                    </div>
                </div>
            </div>
        `;
    }
    html += '</div>';

    container.innerHTML = html;
}

function prevDurchgang() {
    callroomGroupIndex = Math.max(0, callroomGroupIndex - 1);
    saveCallroomGroupIndex();
    renderCallroomOverview();
}

function nextDurchgang() {
    // compute max groups
    const matches = koTreeState && koTreeState.rounds && koTreeState.rounds[0] ? koTreeState.rounds[0] : [];
    const maxGroups = Math.ceil(matches.length / 4);
    callroomGroupIndex = Math.min(maxGroups - 1, callroomGroupIndex + 1);
    saveCallroomGroupIndex();
    renderCallroomOverview();
}

function saveCallroomGroupIndex() {
    const key = `callroomGroup_${currentEventId || 'local'}`;
    localStorage.setItem(key, String(callroomGroupIndex));
}

function loadCallroomGroupIndex() {
    const key = `callroomGroup_${currentEventId || 'local'}`;
    const raw = localStorage.getItem(key);
    callroomGroupIndex = raw ? parseInt(raw, 10) : 0;
}

function saveCallroomRoundIndex() {
    const key = `callroomRound_${currentEventId || 'local'}`;
    localStorage.setItem(key, String(callroomRoundIndex));
}

function loadCallroomRoundIndex() {
    const key = `callroomRound_${currentEventId || 'local'}`;
    const raw = localStorage.getItem(key);
    callroomRoundIndex = raw ? parseInt(raw, 10) : 0;
}

function setCallroomRound(idx) {
    callroomRoundIndex = Math.max(0, Math.min((koTreeState && koTreeState.rounds) ? koTreeState.rounds.length - 1 : idx, idx));
    saveCallroomRoundIndex();
    // reset group index when changing round
    callroomGroupIndex = 0;
    saveCallroomGroupIndex();
    renderCallroomOverview();
}

function swapSides(matchIndex) {
    if(!koTreeState || !koTreeState.rounds || !koTreeState.rounds[0]) return;
    const match = koTreeState.rounds[0][matchIndex];
    if(!match) return;
    const tmp = match.p1;
    match.p1 = match.p2;
    match.p2 = tmp;

    // Swap statuses if present
    const statuses = getCallroomStatuses();
    const key = match.id || `m_${matchIndex}`;
    if(statuses[key]) {
        const tmpS = statuses[key].p1;
        statuses[key].p1 = statuses[key].p2;
        statuses[key].p2 = tmpS;
        saveCallroomStatuses(statuses);
    }

    renderCallroomOverview();
    refreshTableauDisplay();

    if(firebaseSyncEnabled && currentEventId && firebaseDB) {
        syncKOTreeToFirebase(koTreeState);
        // sync statuses as they might have been swapped
        try { syncCallroomStatusesToFirebase(getCallroomStatuses()); } catch(e) {}
    }
}

function toggleFencerStatus(matchIndex, playerNum) {
    if(!koTreeState || !koTreeState.rounds || !koTreeState.rounds[0]) return;
    const match = koTreeState.rounds[0][matchIndex];
    if(!match) return;
    const key = match.id || `m_${matchIndex}`;
    const statuses = getCallroomStatuses();
    if(!statuses[key]) statuses[key] = {p1: 'Abwesend', p2: 'Abwesend'};

    const field = playerNum === 1 ? 'p1' : 'p2';
    const cur = statuses[key][field] || 'Abwesend';
    const nextIdx = (CALLER_STATUSES.indexOf(cur) + 1) % CALLER_STATUSES.length;
    statuses[key][field] = CALLER_STATUSES[nextIdx];
    saveCallroomStatuses(statuses);

    renderCallroomOverview();
    // Sync to Firebase if enabled
    if(firebaseSyncEnabled && currentEventId && firebaseDB) {
        try { syncCallroomStatusesToFirebase(getCallroomStatuses()); } catch(e) {}
    }
}

// -------- Log Panel UI --------
function showLogPanel() {
    // remove existing
    const old = document.getElementById('logModal'); if(old) old.remove();
    const modal = document.createElement('div');
    modal.id = 'logModal';
    modal.innerHTML = `
        <div class="log-modal-overlay"></div>
        <div class="log-modal">
            <div class="log-modal-header">
                <h3>App-Logs</h3>
                <div class="log-actions">
                    <button id="logPersistBtn">Persist</button>
                    <button id="logDownloadBtn">Download</button>
                    <button id="logCloseBtn">Schließen</button>
                </div>
            </div>
            <div id="logContent" class="log-content"></div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('logCloseBtn').addEventListener('click', closeLogPanel);
    document.getElementById('logPersistBtn').addEventListener('click', () => { logger.persist(); alert('Logs persistiert in localStorage'); });
    document.getElementById('logDownloadBtn').addEventListener('click', downloadLogs);
    renderLogPanel();
    // Live update
    try {
        modal._logInterval = setInterval(renderLogPanel, 1000);
    } catch(e) {}
}

function closeLogPanel() {
    const old = document.getElementById('logModal');
    if(old) {
        try {
            if(old._logInterval) clearInterval(old._logInterval);
        } catch(e) {}
        old.remove();
    }
}

function renderLogPanel() {
    const content = document.getElementById('logContent');
    if(!content) return;
    const logs = logger.dump().slice().reverse();
    content.innerHTML = logs.map(l => `<div class="log-entry"><span class="log-ts">${l.ts}</span> <span class="log-level">${l.level}</span> <span class="log-msg">${l.message}</span></div>`).join('\n');
}

function downloadLogs() {
    const data = JSON.stringify(logger.dump(), null, 2);
    const blob = new Blob([data], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `callroom-logs-${Date.now()}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// 5. Seiten-Inhalte definieren
const pages = {
    home: `
        <div id="home-content"></div>
    `,
    settings: `
        <h1>Einstellungen</h1>
        <p>Hier kannst du deine App konfigurieren.</p>
        <div class="settings-container">
            <div class="settings-section">
                <h3>Modus</h3>
                <label for="modeToggle">Modus:</label>
                <div class="toggle-group">
                    <button id="modeEinzel" class="mode-btn active">Einzel</button>
                    <button id="modeTeam" class="mode-btn">Team</button>
                </div>
                <p id="modeDisplay">Aktueller Modus: <strong>Einzel</strong> (64er KO)</p>
            </div>
            
            <div class="settings-section">
                <h3>Bahnfarben & Namen</h3>
                <p>Definiere Namen und Farben für die 4 Bahnen:</p>
                <div id="laneSettingsContainer"></div>
                <button id="saveLaneSettingsBtn" class="settings-btn">Bahneinstellungen speichern</button>
            </div>
            
            <div class="settings-section">
                <h3>Veranstaltung</h3>
                <button id="newEventBtn" class="settings-btn" style="background-color: #ff6b6b; color: white; border-color: #ff6b6b;">Neue Veranstaltung</button>
                <p><small>Löscht alle gespeicherten Daten des aktuellen Turniers.</small></p>
            </div>
        </div>
    `,
    overview: `
        <h1>Übersicht</h1>
        <p>Hier findest du eine Übersicht über alle Funktionen.</p>
    `,
    missing_fencers: `
        <h1>Fehlende Fechter</h1>
        <div id="missing-fencers-content"></div>
    `,
    tableau: `
        <h1>Tableau</h1>
        <div id="tableau-content"></div>
    `,
    tableau_input: `
        <h1>Tableau eintragen</h1>
        <p>Gib die Fechter-IDs ein. Sie werden in der Reihenfolge 1vs64, 2vs63, etc. gepaart.</p>
        <div id="inputs-container" class="inputs-grid"></div>
        <p><button id="submitTableau">Eintragen</button> <button id="testTableau">Test</button></p>
    `,
    workspace: `
        <h1>Callroom</h1>
        <div class="callroom-controls" style="text-align:center; margin: 10px 0;">
            <button id="callroom-prev">←</button>
            <select id="callroom-round-select" style="margin: 0 8px;"></select>
            <span id="callroom-label" style="margin: 0 12px; font-weight:bold;">Durchgang 1 / 1</span>
            <button id="callroom-next">→</button>
            <button id="show-logs-btn" style="margin-left:12px;">Logs</button>
        </div>
        <div id="callroom-overview" class="callroom-overview"></div>
    `,
    podium: `
        <h1>Podium</h1>
        <p>Hier findest du das Podium.</p>
    `,
    sync: `
        <h1>Verbindung</h1>
        <div id="sync-content"></div>
    `,
    permissions: `
        <h1>Berechtigungen</h1>
        <div id="permissions-content"></div>
    `
};

// 6. Navigations-Funktion
function navigate(pageId) {
    const appContainer = document.getElementById('app');
    
    // Fallback wenn pageId nicht in pages existiert
    if(!pages[pageId]) {
        console.error('Seite nicht gefunden:', pageId);
        appContainer.innerHTML = '<h1>Seite nicht gefunden</h1><p>Die Seite "' + pageId + '" existiert nicht.</p>';
        return;
    }
    
    appContainer.innerHTML = pages[pageId];

    const mode = getTableauMode();

    // Spezielle Event-Listener für Inhalte hinzufügen
    if(pageId === 'home') {
        const homeContent = document.getElementById('home-content');
        
        if(!isAuthenticated) {
            // Login-Seite
            homeContent.innerHTML = `
                <div style="max-width: 400px; margin: 60px auto; padding: 40px; background: white; border: 2px solid #023b82; border-radius: 8px; text-align: center; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                    <h1 style="color: #023b82; margin-top: 0;">Callroom App</h1>
                    <p style="color: #666; margin-bottom: 30px;">Bitte melden Sie sich an</p>
                    
                    <div style="margin-bottom: 15px;">
                        <input type="text" id="loginUsername" placeholder="Benutzername" style="width: 100%; padding: 12px; border: 2px solid #023b82; border-radius: 4px; font-size: 16px; box-sizing: border-box;">
                    </div>
                    
                    <div style="margin-bottom: 30px;">
                        <input type="password" id="loginPassword" placeholder="Passwort" style="width: 100%; padding: 12px; border: 2px solid #023b82; border-radius: 4px; font-size: 16px; box-sizing: border-box;">
                    </div>
                    
                    <button id="loginBtn" style="width: 100%; padding: 12px; background-color: #5bd2fe; color: #023b82; border: 2px solid #023b82; border-radius: 4px; font-size: 16px; font-weight: bold; cursor: pointer;">Anmelden</button>
                    
                    <p id="loginError" style="color: #f44336; margin-top: 15px; display: none;"></p>
                </div>
            `;
            
            const loginBtn = document.getElementById('loginBtn');
            const loginUsername = document.getElementById('loginUsername');
            const loginPassword = document.getElementById('loginPassword');
            const loginError = document.getElementById('loginError');
            
            loginBtn.addEventListener('click', () => {
                const username = loginUsername.value.trim();
                const password = loginPassword.value;
                
                if(!username || !password) {
                    loginError.textContent = 'Bitte geben Sie Benutzername und Passwort ein';
                    loginError.style.display = 'block';
                    return;
                }
                
                // Authentifiziere Benutzer (lädt Firebase-Daten automatisch)
                authenticateUser(username, password).then((success) => {
                    if(success) {
                        loginError.style.display = 'none';
                        updateNavigationButtons();
                        navigate('home');
                    } else {
                        loginError.textContent = 'Ungültige Anmeldedaten';
                        loginError.style.display = 'block';
                        loginPassword.value = '';
                    }
                }).catch((error) => {
                    logger.error('Login Fehler:', error);
                    loginError.textContent = 'Fehler beim Anmelden. Bitte versuchen Sie es später';
                    loginError.style.display = 'block';
                    loginPassword.value = '';
                });
            });
            
            // Enter-Taste zum Anmelden
            loginPassword.addEventListener('keypress', (e) => {
                if(e.key === 'Enter') loginBtn.click();
            });
            
        } else {
            // Willkommensseite für angemeldete Benutzer
            homeContent.innerHTML = `
                <div style="max-width: 600px; margin: 40px auto; padding: 30px; background: white; border-radius: 8px; text-align: center;">
                    <h1 style="color: #023b82;">Willkommen, ${currentUser.username}!</h1>
                    <p style="color: #666; font-size: 18px;">Du bist erfolgreich angemeldet.</p>
                    
                    ${currentUser.isAdmin ? `
                        <div style="background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #2196F3;">
                            <p style="color: #1976d2; margin: 0;"><strong>👑 Administrator-Konto</strong></p>
                        </div>
                    ` : ''}
                    
                    <button onclick="logoutAndRefresh()" style="padding: 12px 30px; background-color: #ff6b6b; color: white; border: 2px solid #ff6b6b; border-radius: 4px; font-size: 16px; font-weight: bold; cursor: pointer; margin-top: 20px;">Abmelden</button>
                </div>
            `;
        }
    }

    // Settings-Seite: Toggle zwischen Einzel und Team + Bahnfarben
    if(pageId === 'settings') {
        const btnEinzel = document.getElementById('modeEinzel');
        const btnTeam = document.getElementById('modeTeam');
        const modeDisplay = document.getElementById('modeDisplay');
        const laneColorsContainer = document.getElementById('laneColorsContainer');
        const saveLaneColorsBtn = document.getElementById('saveLaneColorsBtn');
        const newEventBtn = document.getElementById('newEventBtn');
        
        // Modus-Toggle
        const updateButtons = () => {
            const currentMode = getTableauMode();
            if(currentMode === 'einzel') {
                btnEinzel.classList.add('active');
                btnTeam.classList.remove('active');
                modeDisplay.innerHTML = 'Aktueller Modus: <strong>Einzel</strong> (64er KO)';
            } else {
                btnEinzel.classList.remove('active');
                btnTeam.classList.add('active');
                modeDisplay.innerHTML = 'Aktueller Modus: <strong>Team</strong> (16er KO)';
            }
        };
        
        btnEinzel.addEventListener('click', () => {
            setTableauMode('einzel');
            updateButtons();
        });
        
        btnTeam.addEventListener('click', () => {
            setTableauMode('team');
            updateButtons();
        });
        
        // Bahnfarben und Bahnnamen kombinierte Eingabe
        const laneSettingsContainer = document.getElementById('laneSettingsContainer');
        const saveLaneSettingsBtn = document.getElementById('saveLaneSettingsBtn');
        const laneColors = getLaneColors();
        const laneNames = getLaneNames();
        laneSettingsContainer.innerHTML = '';
        
        for(let i = 0; i < 5; i++) {
            const settingDiv = document.createElement('div');
            settingDiv.className = 'lane-setting-group';
            settingDiv.innerHTML = `
                <div class="lane-setting-name">
                    <label>Name Bahn ${i + 1}:</label>
                    <input type="text" id="laneName${i}" value="${laneNames[i]}" class="lane-name-input" placeholder="z.B. Bahn 1">
                </div>
                <div class="lane-setting-color">
                    <label>Farbe:</label>
                    <div class="lane-color-controls">
                        <input type="color" id="laneColor${i}" value="${laneColors[i]}" class="lane-color-input">
                        <input type="text" id="laneColorText${i}" value="${laneColors[i]}" class="lane-color-text" placeholder="#FF0000">
                    </div>
                </div>
            `;
            laneSettingsContainer.appendChild(settingDiv);
            
            // Sync zwischen Color-Picker und Text-Input
            const colorPicker = document.getElementById(`laneColor${i}`);
            const colorText = document.getElementById(`laneColorText${i}`);
            
            colorPicker.addEventListener('change', () => {
                colorText.value = colorPicker.value;
            });
            
            colorText.addEventListener('change', () => {
                if(/^#[0-9A-F]{6}$/i.test(colorText.value)) {
                    colorPicker.value = colorText.value;
                }
            });
        }
        
        saveLaneSettingsBtn.addEventListener('click', () => {
            const newColors = [];
            const newNames = [];
            for(let i = 0; i < 5; i++) {
                const colorText = document.getElementById(`laneColorText${i}`).value;
                const nameText = document.getElementById(`laneName${i}`).value || `Bahn ${i + 1}`;
                newColors.push(colorText);
                newNames.push(nameText);
            }
            setLaneColors(newColors);
            setLaneNames(newNames);
            alert('Bahneinstellungen gespeichert!');
        });
        
        newEventBtn.addEventListener('click', () => {
            // Erste Bestätigung
            if(!confirm('⚠️ WARNUNG: Möchtest du wirklich eine neue Veranstaltung erstellen?\n\nDies löscht alle aktuellen Turnierdaten unwiderruflich!')) {
                return;
            }
            
            // Zweite Bestätigung für zusätzliche Sicherheit
            if(!confirm('Bist du dir wirklich sicher?\n\nAlle Gefechte, Ergebnisse und Einstellungen werden gelöscht!')) {
                return;
            }
            
            // Lösche alle Daten
            localStorage.removeItem('tableauValues');
            localStorage.removeItem('tableauMode_saved');
            localStorage.removeItem('currentEventId');
            koTreeState = null;
            currentEventId = null;
            
            // Setze Flag, dass Tableau eingegeben werden kann
            localStorage.setItem('canEnterTableau', 'true');
            
            alert('✓ Alle Daten gelöscht.\n\nDu kannst jetzt unter "Tableau eintragen" ein neues Turnier erstellen.');
            updateNavigationButtons();
        });
        
        updateButtons();
    }

    // Tableau-Eingabe: 64 oder 16 Felder basierend auf Modus
    if(pageId === 'tableau_input') {
        const container = document.getElementById('inputs-container');
        const numInputs = mode === 'einzel' ? 64 : 16;
        
        if(container) {
            container.innerHTML = '';
            for(let i = 0; i < numInputs; i++) {
                const input = document.createElement('input');
                input.type = 'text';
                input.id = `input-${i+1}`;
                input.name = `input-${i+1}`;
                input.placeholder = `ID ${i+1}`;
                input.className = 'tableau-input';
                input.setAttribute('data-index', i + 1);
                container.appendChild(input);
            }
        }
        
        const submitBtn = document.getElementById('submitTableau');
        if(submitBtn) {
            submitBtn.addEventListener('click', () => {
                const values = [];
                for(let i = 0; i < numInputs; i++) {
                    const v = document.getElementById(`input-${i+1}`)?.value || '';
                    values.push(v);
                }
                localStorage.setItem('tableauValues', JSON.stringify(values));
                localStorage.setItem('tableauMode_saved', mode);
                logger.info('Tableau-Werte gespeichert:', values);
                
                // Generiere Event ID aus Timestamp
                const eventId = 'event_' + Date.now();
                currentEventId = eventId;
                localStorage.setItem('currentEventId', eventId);
                
                // Lösche das "canEnterTableau" Flag nach erfolgreichem Eintragen
                localStorage.removeItem('canEnterTableau');
                
                // Firebase Sync ZUERST aktivieren, DANN Daten speichern
                if(firebaseDB) {
                    initializeFirebaseSync(eventId);
                    syncTableauValuesToFirebase(values, mode);
                }
                
                alert('Werte gespeichert! Sieh dir das Tableau an.');
                updateNavigationButtons();
            });
        }
        
        const testBtn = document.getElementById('testTableau');
        if(testBtn) {
            testBtn.addEventListener('click', () => {
                const fencerIds = Object.keys(fencersDB);
                if(fencerIds.length === 0) {
                    alert('Keine Fechter in der Datenbank gefunden.');
                    return;
                }
                
                // Generiere zufällige Kombination
                const testValues = [];
                const selectedIds = new Set();
                
                for(let i = 0; i < numInputs; i++) {
                    let randomId;
                    do {
                        randomId = fencerIds[Math.floor(Math.random() * fencerIds.length)];
                    } while(selectedIds.has(randomId));
                    
                    selectedIds.add(randomId);
                    testValues.push(randomId);
                    document.getElementById(`input-${i+1}`).value = randomId;
                }
                
                alert('Test-Daten eingefügt! Klicke "Eintragen" zum Speichern.');
            });
        }
    }

    // Tableau-Anzeige: KO-Baum (64 oder 16)
    if(pageId === 'tableau') {
        const contentDiv = document.getElementById('tableau-content');
        const numParticipants = mode === 'einzel' ? 64 : 16;
        const modeLabel = mode === 'einzel' ? '64er KO-Baum' : '16er KO-Baum';
        
        // Prüfe zuerst, ob koTreeState bereits von Firebase geladen wurde
        if(koTreeState && koTreeState.rounds && koTreeState.rounds.length > 0) {
            logger.info('Tableau: Verwende Daten von Firebase');
            contentDiv.innerHTML = renderKOTree(koTreeState);
            return;
        }
        
        // Lade gespeicherte Werte aus localStorage
        const savedValues = localStorage.getItem('tableauValues');
        const values = savedValues ? JSON.parse(savedValues) : Array(numParticipants).fill('');
        
        // Filtere nur gültige Fechter-IDs
        const validFencerIds = values.filter(v => v && getFencerById(v));
        
        if(validFencerIds.length === 0) {
            // Warte bis zu 3 Sekunden auf Firebase-Daten
            if(currentEventId && !koTreeState) {
                contentDiv.innerHTML = `<h2>${modeLabel}</h2><p>Lade Daten von Firebase...</p>`;
                
                // Warte auf Firebase-Listener
                let waitCount = 0;
                const waitInterval = setInterval(() => {
                    waitCount++;
                    if(koTreeState && koTreeState.rounds && koTreeState.rounds.length > 0) {
                        clearInterval(waitInterval);
                        logger.info('Firebase-Daten geladen, aktualisiere Tableau');
                        contentDiv.innerHTML = renderKOTree(koTreeState);
                    } else if(waitCount >= 30) { // 3 Sekunden (30 * 100ms)
                        clearInterval(waitInterval);
                        contentDiv.innerHTML = `<h2>${modeLabel}</h2><p>Keine gültigen Fechter-IDs eingegeben. Bitte geh zu "Tableau eintragen".</p>`;
                        logger.warn('Timeout beim Laden von Firebase-Daten');
                    }
                }, 100);
                return;
            }
            
            contentDiv.innerHTML = `<h2>${modeLabel}</h2><p>Keine gültigen Fechter-IDs eingegeben. Bitte geh zu "Tableau eintragen".</p>`;
            return;
        }
        
        // Generiere KO-Baum (übergebe mode Parameter)
        koTreeState = generateKOTree(numParticipants, mode);
        populateKOTreeFirstRound(koTreeState, validFencerIds, mode);
        
        // Synce zu Firebase beim Laden
        if(firebaseDB) {
            const storedEventId = localStorage.getItem('currentEventId');
            if(storedEventId) {
                currentEventId = storedEventId;
                initializeFirebaseSync(storedEventId);
                syncKOTreeToFirebase(koTreeState);
            }
        }
        
        contentDiv.innerHTML = `<h2>${modeLabel}</h2>` + renderKOTree(koTreeState);
    }

    // Callroom-Seite: Übersicht über Durchgänge
    if(pageId === 'workspace') {
        // Lade ggf. gespeicherte Gruppe
        loadCallroomGroupIndex();

        const prevBtn = document.getElementById('callroom-prev');
        const nextBtn = document.getElementById('callroom-next');
        const showLogsBtn = document.getElementById('show-logs-btn');

        if(prevBtn) prevBtn.addEventListener('click', (e) => { e.preventDefault(); prevDurchgang(); });
        if(nextBtn) nextBtn.addEventListener('click', (e) => { e.preventDefault(); nextDurchgang(); });
        if(showLogsBtn) showLogsBtn.addEventListener('click', (e) => { e.preventDefault(); showLogPanel(); });

        renderCallroomOverview();
    }

    // Fehlende Fechter Seite
    if(pageId === 'missing_fencers') {
        const content = document.getElementById('missing-fencers-content');
        if(!content) return;

        if(!koTreeState || !koTreeState.rounds || koTreeState.rounds.length === 0) {
            content.innerHTML = '<p>Kein Turnier geladen.</p>';
            return;
        }

        // Hole alle Status
        const statuses = getCallroomStatuses();

        // Sammle Fechter nach Durchgang, die "Abwesend" sind
        const firstRound = koTreeState.rounds[0] || [];
        const byDurchgang = {};

        firstRound.forEach((match, idx) => {
            const durchgang = Math.floor(idx / 4);
            if(!byDurchgang[durchgang]) byDurchgang[durchgang] = [];

            const statusKey = match.id || `m_${idx}`;
            const s1 = (statuses[statusKey] && statuses[statusKey].p1) || 'Abwesend';
            const s2 = (statuses[statusKey] && statuses[statusKey].p2) || 'Abwesend';

            // Füge nur hinzu, wenn Status "Abwesend" ist
            if(match.p1 && s1 === 'Abwesend') {
                byDurchgang[durchgang].push({ fencer: match.p1, status: s1 });
            }
            if(match.p2 && s2 === 'Abwesend') {
                byDurchgang[durchgang].push({ fencer: match.p2, status: s2 });
            }
        });

        let html = '';
        const sortedDurchgaenge = Object.keys(byDurchgang).map(Number).sort((a, b) => a - b);
        const totalMissing = sortedDurchgaenge.reduce((sum, d) => sum + byDurchgang[d].length, 0);

        if(totalMissing === 0) {
            html = '<p>Alle Fechter sind als "Anwesend" oder "kontrolliert" markiert.</p>';
        } else {
            html = `<p>Insgesamt ${totalMissing} Fechter haben Status "Abwesend":</p>`;
            sortedDurchgaenge.forEach(durchgang => {
                if(byDurchgang[durchgang].length > 0) {
                    html += `<div class="missing-durchgang-group">`;
                    html += `<h3>Durchgang ${durchgang + 1}</h3>`;
                    html += `<div class="missing-fencers-list">`;
                    byDurchgang[durchgang].forEach(item => {
                        html += `<div class="missing-fencer-entry">${getFencerDisplay(item.fencer)}</div>`;
                    });
                    html += `</div></div>`;
                }
            });
        }
        content.innerHTML = html;
    }
    
    // ===== MULTI-DEVICE SYNCHRONISIERUNG =====
    if(pageId === 'sync') {
        const syncContent = document.getElementById('sync-content');
        const currentId = localStorage.getItem('currentEventId');

        syncContent.innerHTML = `
            <div style="max-width: 1200px; margin: 20px auto; display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                
                <!-- Left: QR Code Scanner -->
                <div style="border: 2px solid #023b82; border-radius: 8px; padding: 20px; background: #f9f9f9;">
                    <h3 style="color: #023b82; margin-top: 0;">QR-Code Scannen</h3>
                    <p style="font-size: 14px; color: #666;">Scanne einen QR-Code um dich zu verbinden:</p>
                    
                    <div id="qr-scanner" style="width: 100%; max-width: 400px; margin: 20px auto;"></div>
                    <div style="text-align: center;">
                        <button id="startScannerBtn" style="padding: 10px 20px; background-color: #5bd2fe; color: #023b82; border: 2px solid #023b82; border-radius: 4px; cursor: pointer; font-weight: bold; margin: 10px 5px;">Scanner starten</button>
                        <button id="stopScannerBtn" style="padding: 10px 20px; background-color: #ff6b6b; color: white; border: 2px solid #ff6b6b; border-radius: 4px; cursor: pointer; font-weight: bold; margin: 10px 5px; display: none;">Scanner stoppen</button>
                    </div>
                    <div id="scanResult" style="margin-top: 20px; text-align: center; color: #666;"></div>
                </div>
                
                <!-- Right: Manual Input & QR Generator -->
                <div style="border: 2px solid #023b82; border-radius: 8px; padding: 20px; background: #f9f9f9;">
                    <h3 style="color: #023b82; margin-top: 0;">Manuelle Eingabe</h3>
                    <p style="font-size: 14px; color: #666;">Gib die Event-ID ein oder geneiere einen QR-Code:</p>
                    
                    <div style="margin: 20px 0;">
                        <input type="text" id="eventIdInput" placeholder="Event-ID eingeben" style="padding: 12px; font-size: 16px; border: 2px solid #023b82; border-radius: 4px; width: 100%; margin-bottom: 10px; font-family: monospace;">
                        <button onclick="joinEventById()" style="width: 100%; padding: 12px; font-size: 16px; background-color: #5bd2fe; color: #023b82; border: 2px solid #023b82; border-radius: 4px; cursor: pointer; font-weight: bold;">Verbinden</button>
                    </div>

                    ${currentId ? `
                        <div style="margin-top: 30px; text-align: center;">
                            <h4 style="color: #023b82;">QR-Code für aktives Event</h4>
                            <p style="font-size: 12px; color: #666; font-family: monospace; background: white; padding: 8px; border-radius: 4px;">Event-ID: <strong>${currentId}</strong></p>
                            <div id="qrcode-generator" style="padding: 16px; background: white; display: inline-block; border-radius: 8px; margin-top: 12px;"></div>
                            <p style="font-size: 12px; color: #666; margin-top: 12px;">Teile diesen QR-Code mit anderen Geräten</p>
                        </div>
                    ` : `
                        <div style="margin-top: 30px; padding: 20px; background: #fff3cd; border-radius: 4px; border-left: 4px solid #ffc107; color: #856404;">
                            <strong>Hinweis:</strong> Kein aktives Event vorhanden. Erstelle zuerst ein Tableau, um einen QR-Code zu generieren.
                        </div>
                    `}
                </div>
            </div>
        `;

        // QR-Code Generator für aktive Event
        if(currentId && typeof QRCode !== 'undefined') {
            setTimeout(() => {
                const qrDiv = document.getElementById('qrcode-generator');
                if(qrDiv && qrDiv.innerHTML === '') {
                    const baseUrl = window.location.origin + window.location.pathname + '?eventId=';
                    new QRCode(qrDiv, {
                        text: baseUrl + currentId,
                        width: 250,
                        height: 250
                    });
                }
            }, 100);
        }

        // Scanner Button Handler
        const startBtn = document.getElementById('startScannerBtn');
        const stopBtn = document.getElementById('stopScannerBtn');

        if(startBtn) {
            startBtn.addEventListener('click', () => {
                startQRScanner();
                startBtn.style.display = 'none';
                stopBtn.style.display = 'inline-block';
            });
        }

        if(stopBtn) {
            stopBtn.addEventListener('click', () => {
                stopQRScanner();
                stopBtn.style.display = 'none';
                startBtn.style.display = 'inline-block';
            });
        }

        // Focus auf Input bei Laden
        setTimeout(() => {
            const input = document.getElementById('eventIdInput');
            if(input) input.focus();
        }, 100);
    }
    
    // Berechtigungen-Seite (nur für Admin sichtbar)
    if(pageId === 'permissions') {
        if(!currentUser || !currentUser.isAdmin) {
            document.getElementById('permissions-content').innerHTML = '<p style="color: #f44336;">Sie haben keine Berechtigung für diese Seite.</p>';
            return;
        }
        
        const permissionsContent = document.getElementById('permissions-content');
        const users = getUsers();
        const usernames = Object.keys(users);
        
        let html = `
            <div style="max-width: 1000px; margin: 20px auto;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                    <!-- Neuen Benutzer erstellen -->
                    <div style="border: 2px solid #023b82; border-radius: 8px; padding: 20px; background: #f9f9f9;">
                        <h3 style="color: #023b82; margin-top: 0;">Neuen Benutzer erstellen</h3>
                        
                        <div style="margin: 15px 0;">
                            <label style="display: block; color: #023b82; font-weight: bold; margin-bottom: 5px;">Benutzername:</label>
                            <input type="text" id="newUsername" placeholder="Benutzername" style="width: 100%; padding: 10px; border: 2px solid #023b82; border-radius: 4px; box-sizing: border-box;">
                        </div>
                        
                        <div style="margin: 15px 0;">
                            <label style="display: block; color: #023b82; font-weight: bold; margin-bottom: 5px;">Passwort:</label>
                            <input type="password" id="newPassword" placeholder="Passwort" style="width: 100%; padding: 10px; border: 2px solid #023b82; border-radius: 4px; box-sizing: border-box;">
                        </div>
                        
                        <div style="margin: 15px 0;">
                            <label style="display: block; color: #023b82; font-weight: bold; margin-bottom: 10px;">Sichtbare Reiter:</label>
                            <div style="background: white; padding: 10px; border: 2px solid #023b82; border-radius: 4px; max-height: 250px; overflow-y: auto;">
                                ${ALL_TABS.map(tab => `
                                    <div style="margin: 8px 0;">
                                        <input type="checkbox" id="newPerm_${tab}" value="${tab}" checked style="margin-right: 8px;">
                                        <label for="newPerm_${tab}" style="cursor: pointer;">${tab.charAt(0).toUpperCase() + tab.slice(1)}</label>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <button id="createUserBtn" style="width: 100%; padding: 12px; background-color: #4caf50; color: white; border: 2px solid #4caf50; border-radius: 4px; font-size: 16px; font-weight: bold; cursor: pointer; margin-top: 15px;">Benutzer erstellen</button>
                        <div id="createUserError" style="color: #f44336; margin-top: 10px; display: none;"></div>
                    </div>
                    
                    <!-- Benutzer verwalten -->
                    <div style="border: 2px solid #023b82; border-radius: 8px; padding: 20px; background: #f9f9f9;">
                        <h3 style="color: #023b82; margin-top: 0;">Benutzer verwalten</h3>
                        
                        <div style="background: white; border-radius: 4px; max-height: 500px; overflow-y: auto;">
                            ${usernames.map(username => {
                                const user = users[username];
                                return `
                                    <div id="userRow_${username}" style="padding: 15px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center;">
                                        <div>
                                            <p style="margin: 0; font-weight: bold; color: #023b82;">${username}</p>
                                            <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">
                                                ${user.isAdmin ? '👑 Admin' : user.permissions.length + ' Tab(s) sichtbar'}
                                            </p>
                                        </div>
                                        ${username !== 'admin' ? `
                                            <button onclick="editUserPermissions('${username}')" style="padding: 8px 15px; background-color: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">Bearbeiten</button>
                                            <button onclick="deleteUserConfirm('${username}')" style="padding: 8px 15px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Löschen</button>
                                        ` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Modal für Berechtigungen bearbeiten -->
            <div id="editPermissionsModal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
                <div style="background: white; padding: 30px; border-radius: 8px; max-width: 400px; width: 90%;">
                    <h3 id="editUsername" style="color: #023b82; margin-top: 0;"></h3>
                    
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 4px; margin: 15px 0; max-height: 300px; overflow-y: auto;">
                        ${ALL_TABS.map(tab => `
                            <div style="margin: 10px 0;">
                                <input type="checkbox" id="editPerm_${tab}" value="${tab}" style="margin-right: 8px;">
                                <label for="editPerm_${tab}" style="cursor: pointer;">${tab.charAt(0).toUpperCase() + tab.slice(1)}</label>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div style="display: flex; gap: 10px;">
                        <button onclick="saveUserPermissions()" style="flex: 1; padding: 10px; background-color: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Speichern</button>
                        <button onclick="closeEditModal()" style="flex: 1; padding: 10px; background-color: #888; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Abbrechen</button>
                    </div>
                </div>
            </div>
        `;
        
        permissionsContent.innerHTML = html;
        
        // Event-Listener
        document.getElementById('createUserBtn').addEventListener('click', () => {
            const username = document.getElementById('newUsername').value.trim();
            const password = document.getElementById('newPassword').value;
            const errorDiv = document.getElementById('createUserError');
            
            if(!username || !password) {
                errorDiv.textContent = 'Benutzername und Passwort erforderlich';
                errorDiv.style.display = 'block';
                return;
            }
            
            const permissions = ALL_TABS.filter(tab => 
                document.getElementById(`newPerm_${tab}`).checked
            );
            
            if(createUser(username, password, permissions)) {
                errorDiv.style.display = 'none';
                alert('Benutzer erfolgreich erstellt!');
                navigate('permissions');
            } else {
                errorDiv.textContent = 'Benutzer existiert bereits';
                errorDiv.style.display = 'block';
            }
        });
    }
}

// Hilfsfunktionen für Permissions
let currentEditingUser = null;

function editUserPermissions(username) {
    currentEditingUser = username;
    const users = getUsers();
    const user = users[username];
    
    document.getElementById('editUsername').textContent = `Berechtigungen für: ${username}`;
    
    // Setze Checkboxen
    ALL_TABS.forEach(tab => {
        const checkbox = document.getElementById(`editPerm_${tab}`);
        if(checkbox) {
            checkbox.checked = user.permissions.includes(tab);
        }
    });
    
    document.getElementById('editPermissionsModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editPermissionsModal').style.display = 'none';
    currentEditingUser = null;
}

function saveUserPermissions() {
    if(!currentEditingUser) return;
    
    const permissions = ALL_TABS.filter(tab => 
        document.getElementById(`editPerm_${tab}`).checked
    );
    
    if(updateUserPermissions(currentEditingUser, permissions)) {
        alert('Berechtigungen aktualisiert!');
        closeEditModal();
        navigate('permissions');
    }
}

function deleteUserConfirm(username) {
    if(confirm(`Möchtest du den Benutzer "${username}" wirklich löschen?`)) {
        if(deleteUser(username)) {
            alert('Benutzer gelöscht!');
            navigate('permissions');
        }
    }
}

function logoutAndRefresh() {
    logoutUser();
    updateNavigationButtons();
    navigate('home');
}

// Funktion zur Aktualisierung der Navigations-Buttons
function updateNavigationButtons() {
    const navButtons = document.querySelectorAll('nav button');
    const savedValues = localStorage.getItem('tableauValues');
    const hasData = savedValues && JSON.parse(savedValues).some(v => v && getFencerById(v));
    const canEnterTableau = localStorage.getItem('canEnterTableau') === 'true';
    
    const tabNameMap = {
        'Home': 'home',
        'Einstellungen': 'settings',
        'Übersicht': 'overview',
        'Fehlende Fechter': 'missing_fencers',
        'Tableau': 'tableau',
        'Tableau eintragen': 'tableau_input',
        'Callroom': 'workspace',
        'Podium': 'podium',
        'Verbindung': 'sync',
        'Berechtigungen': 'permissions'
    };
    
    navButtons.forEach(btn => {
        const btnText = btn.textContent.trim();
        const pageId = tabNameMap[btnText];
        
        // Spezialbehandlung für Tableau eintragen
        if(btnText === 'Tableau eintragen') {
            btn.style.display = (!hasData && canEnterTableau) ? 'inline-block' : 'none';
            return;
        }
        
        // Nur für authentifizierte Benutzer sichtbar
        if(!isAuthenticated) {
            btn.style.display = 'none';
            return;
        }
        
        // Berechtigungen prüfen
        if(pageId) {
            if(pageId === 'permissions') {
                // Nur Admin sieht Permissions-Tab
                btn.style.display = (currentUser && currentUser.isAdmin) ? 'inline-block' : 'none';
            } else if(currentUser && currentUser.permissions.includes(pageId)) {
                // Benutzer sieht nur Tabs, für die er Berechtigung hat
                btn.style.display = 'inline-block';
            } else {
                btn.style.display = 'none';
            }
        }
    });
}

// ============================================
// MULTI-DEVICE SYNCHRONISIERUNG
// ============================================

// Hilfsfunktion: Verbinde zu Event-ID
function joinEventById() {
    const eventId = document.getElementById('eventIdInput')?.value;
    if(!eventId) {
        alert('Bitte gebe eine Event-ID ein');
        return;
    }
    
    // Speichere die Event-ID und lade die Daten
    localStorage.setItem('currentEventId', eventId);
    currentEventId = eventId;
    
    if(firebaseDB) {
        logger.info('Verbinde zu Event:', eventId);
        initializeFirebaseSync(eventId);
        
        // Warte kurz und lade dann die Seite neu um die Daten anzuzeigen
        setTimeout(() => {
            alert('Mit Event ' + eventId + ' verbunden! Daten werden synchronisiert...');
            // Aktualisiere die aktuelle Seite
            const currentPage = document.querySelector('nav button[style*="background"]')?.textContent || 'tableau';
            navigate(currentPage.toLowerCase().replace(' ', '_'));
        }, 500);
    } else {
        alert('Firebase nicht initialisiert');
    }
}

// QR-Code Scanner Variablen
let qrScannerInstance = null;
let qrScannerRunning = false;

// QR-Code Scanner starten
function startQRScanner() {
    const scannerElement = document.getElementById('qr-scanner');
    if(!scannerElement) return;

    if(typeof Html5Qrcode === 'undefined') {
        logger.error('Html5Qrcode Library nicht geladen');
        alert('QR-Code Scanner konnte nicht geladen werden. Bitte laden Sie die Seite neu.');
        return;
    }

    try {
        qrScannerInstance = new Html5Qrcode('qr-scanner');
        qrScannerRunning = true;

        const qrConfig = { 
            fps: 10, 
            qrbox: { width: 250, height: 250 } 
        };

        qrScannerInstance.start(
            { facingMode: 'environment' }, // Rückkamera verwenden
            qrConfig,
            (decodedText) => {
                onQRCodeScanned(decodedText);
                stopQRScanner();
            },
            (errorMessage) => {
                // Fehler ignorieren - wird nur bei bestimmten Bedingungen ausgelöst
            }
        ).catch((err) => {
            logger.error('Fehler beim Starten des QR-Scanners:', err);
            alert('Kamera konnte nicht gestartet werden. Bitte überprüfen Sie die Berechtigungen.');
            qrScannerRunning = false;
        });
    } catch(e) {
        logger.error('QR-Scanner Fehler:', e);
        alert('Fehler beim Initialisieren des QR-Scanners: ' + e.message);
        qrScannerRunning = false;
    }
}

// QR-Code Scanner stoppen
function stopQRScanner() {
    if(qrScannerInstance && qrScannerRunning) {
        qrScannerInstance.stop().then(() => {
            qrScannerRunning = false;
            logger.info('QR-Code Scanner gestoppt');
        }).catch((err) => {
            logger.warn('Fehler beim Stoppen des Scanners:', err);
            qrScannerRunning = false;
        });
    }
}

// QR-Code wurde gescannt
function onQRCodeScanned(decodedText) {
    logger.info('QR-Code gescannt:', decodedText);
    
    try {
        // Versuche Event-ID aus der URL zu extrahieren
        const url = new URL(decodedText);
        const eventId = url.searchParams.get('eventId');
        
        if(eventId) {
            // Event-ID in die Input-Feld einfügen und automatisch verbinden
            const inputField = document.getElementById('eventIdInput');
            if(inputField) {
                inputField.value = eventId;
                
                const resultDiv = document.getElementById('scanResult');
                if(resultDiv) {
                    resultDiv.innerHTML = `<span style="color: #4caf50; font-weight: bold;">✓ QR-Code erkannt: ${eventId}</span>`;
                }
                
                // Automatisch verbinden
                setTimeout(() => {
                    joinEventById();
                }, 500);
            }
        } else {
            throw new Error('Keine Event-ID im QR-Code gefunden');
        }
    } catch(e) {
        logger.error('Fehler beim Verarbeiten des gescannten QR-Codes:', e);
        const resultDiv = document.getElementById('scanResult');
        if(resultDiv) {
            resultDiv.innerHTML = `<span style="color: #f44336; font-weight: bold;">✗ Ungültiger QR-Code</span>`;
        }
    }
}

// Hilfsfunktion: URL Parameter lesen und Auto-Join
function checkEventIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const eventIdFromUrl = params.get('eventId');
    
    if(eventIdFromUrl && !localStorage.getItem('currentEventId')) {
        logger.info('Event-ID aus URL erkannt:', eventIdFromUrl);
        localStorage.setItem('currentEventId', eventIdFromUrl);
        currentEventId = eventIdFromUrl;
        
        if(firebaseDB) {
            setTimeout(() => initializeFirebaseSync(eventIdFromUrl), 500);
        }
    }
}

// Hilfsfunktion: In Zwischenablage kopieren
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Link kopiert!');
    });
}

// Lade Datenbank beim Start
initializeUsers();
loadFencersDatabase();
restoreSession();

// Prüfe ob Event-ID in URL ist
checkEventIdFromUrl();

// Initialisiere Lane-Einstellungen mit 4 Bahnen als Standard
function initializeLaneSettings() {
    // Prüfe ob Bahnen-Einstellung vorhanden ist
    const savedColors = localStorage.getItem('laneColors');
    const savedNames = localStorage.getItem('laneNames');
    
    // Wenn nichts gespeichert: initialisiere mit 5 Bahnen
    if(!savedColors || !savedNames) {
        localStorage.setItem('laneColors', JSON.stringify(defaultLaneColors));
        localStorage.setItem('laneNames', JSON.stringify(defaultLaneNames));
        logger.info('Lane-Einstellungen initialisiert mit 5 Bahnen');
    } else {
        // Prüfe ob alte 4-Bahnen-Einstellung vorhanden ist und aktualisiere auf 5
        try {
            const colors = JSON.parse(savedColors);
            const names = JSON.parse(savedNames);
            if(colors.length === 4 && names.length === 4) {
                localStorage.setItem('laneColors', JSON.stringify(defaultLaneColors));
                localStorage.setItem('laneNames', JSON.stringify(defaultLaneNames));
                logger.info('Lane-Einstellungen aktualisiert von 4 auf 5 Bahnen');
            }
        } catch(e) {
            logger.error('Fehler beim Aktualisieren der Lane-Einstellungen:', e);
        }
    }
}

initializeLaneSettings();

// Mache setupUserListener global verfügbar
window.setupUserListener = setupUserListener;
window.refreshUsersFromFirebase = refreshUsersFromFirebase;

// Initial die Startseite laden
navigate('home');
updateNavigationButtons();