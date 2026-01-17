# Firebase Integration - Anleitung

## Schritt 1: Firebase Projekt erstellen

1. Gehe zu https://console.firebase.google.com/
2. Klicke auf "Projekt erstellen"
3. Gib einen Projektnamen ein (z.B. "Callroom Turnier")
4. Folge den Anweisungen um das Projekt zu erstellen

## Schritt 2: Web-App registrieren

1. Im Firebase Console gehe zu Projekteinstellungen (Zahnrad oben links)
2. Klicke auf den Tab "Apps"
3. Klicke auf "Neue App hinzufügen" und wähle "Web"
4. Gib einen App-Namen ein (z.B. "Callroom Web")
5. Kopiere die Konfiguration

## Schritt 3: Firebase Konfiguration in die App eintragen

1. Öffne die Datei `firebase-config.js` in deinem Editor
2. Ersetze die Werte mit deiner Firebase Konfiguration:
   - `YOUR_API_KEY` → deine API Key
   - `YOUR_PROJECT_ID` → deine Project ID
   - `YOUR_MESSAGING_SENDER_ID` → deine Messaging Sender ID
   - `YOUR_APP_ID` → deine App ID

Beispiel:
```javascript
const firebaseConfig = {
    apiKey: "AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    authDomain: "callroom-turnier.firebaseapp.com",
    databaseURL: "https://callroom-turnier.firebaseio.com",
    projectId: "callroom-turnier",
    storageBucket: "callroom-turnier.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123def456"
};
```

## Schritt 4: Realtime Database einrichten

1. Im Firebase Console gehe zu "Realtime Database"
2. Klicke "Datenbank erstellen"
3. Wähle "Testmodus" (für Entwicklung - später auf Produktionsmodus wechseln)
4. Wähle die Region

## Schritt 5: Security Rules (wichtig!)

Für Produktivumgebung, ersetze die Default Rules durch:

```json
{
  "rules": {
    "events": {
      "$eventId": {
        ".read": true,
        ".write": true,
        "koTree": {
          ".validate": "newData.isObject()"
        },
        "laneColors": {
          ".validate": "newData.isArray()"
        },
        "laneNames": {
          ".validate": "newData.isArray()"
        },
        "tableauData": {
          ".validate": "newData.isObject()"
        }
      }
    }
  }
}
```

## Wie funktioniert die Synchronisierung?

### Automatische Synchronisierung:

1. **Bei "Eintragen" Klick** (Tableau Setup):
   - Eine einzigartige Event-ID wird generiert
   - Die Tableauwerte werden zu Firebase hochgeladen
   - Firebase Sync wird aktiviert

2. **Beim Tableau anschauen**:
   - Der KO-Baum wird zu Firebase hochgeladen
   - Das Gerät hört auf Echtzeit-Updates von anderen Geräten

3. **Bei Änderungen**:
   - **Sieg setzen/entfernen** → KO-Baum wird synchronisiert
   - **Bahn wechseln** → KO-Baum wird synchronisiert
   - **Bahnfarben ändern** → Bahnfarben werden synchronisiert
   - **Bahnnamen ändern** → Bahnnamen werden synchronisiert

### Datenstruktur in Firebase:

```
events/
└── event_[TIMESTAMP]/
    ├── koTree/
    │   ├── rounds/
    │   ├── consolationRounds/
    │   └── mode/
    ├── laneColors/ [Array von Farbcodes]
    ├── laneNames/ [Array von Namen]
    └── tableauData/
        ├── values/ [Fechter-IDs]
        ├── mode/ [einzel/team]
        └── timestamp/
```

## Verwendung mit mehreren Geräten

1. **Gerät 1** (Turnierleiter): Öffnet die App und erstellt das Turnier
2. **Gerät 2, 3, ...** (Schiedsrichter, Assistent): 
   - Öffnen die gleiche URL (z.B. lokal im Netzwerk)
   - Siehe automatisch den gleichen Turnierbaum
   - Änderungen werden in Echtzeit synchronisiert

## Offline-Modus

Die App funktioniert auch offline (dank Service Worker):
- Lokal können Daten bearbeitet werden
- Beim Wiederherstellen der Verbindung werden Änderungen zu Firebase synchronisiert

## Fehlerbehebung

### Firebase nicht initialisiert?
- Überprüfe die `firebase-config.js` - alle Werte müssen korrekt sein
- Prüfe die Browser-Konsole (F12) auf Fehlermeldungen

### Daten werden nicht synchronisiert?
- Überprüfe die Firebase Security Rules
- Stelle sicher, dass "Testmodus" aktiviert ist (oder deine Rules korrekt sind)
- Prüfe, ob die Realtime Database aktiv ist

### Verschiedene Daten auf verschiedenen Geräten?
- Stelle sicher, dass beide Geräte die gleiche Event-ID nutzen
- Aktualisiere die Seite auf dem anderen Gerät (F5)

## Sicherheit

⚠️ **Wichtig**: Der aktuelle Testmodus erlaubt jedem Lesezugriff. Für produktives Deployment:

1. Authentifizierung einrichten (Firebase Auth)
2. Sicherere Security Rules schreiben
3. Nur autentifizierten Benutzern Zugriff gewähren
4. Verschlüsselung für sensitive Daten erwägen
