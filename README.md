====================
CALLROOM APP
====================

Das Fechtzentrum Heidenheim ist regelmäßig Schauplatz für große internationale Fechtturniere.
Dabei wird auch ein Weltcup Turnier, der Heidenheimer Pokal, ausgerichtet. 
Um die Arbeit, Kommunikation und Transparenz für alle Organisationsmitglieder zu erhöhen, wurde diese Progressive Web App entwickelt.
Der Primäre Einsatzzweck ist die bessere Kommunikation zwischen der Turnierorganisation und dem Callroom, welche örtlich getrennt sind. Der Callroom ist ein Raum indem die Fechter für den nächsten Durchgang zusammenkommen, das Equiptment gecheckt wird und die Fechter für den Einlauf vorbereitet werden. Dafür soll für die Turnierorganisation immer der aktuelle Status des Callroom ersichtlich sein. Zusätzlich soll der Callroommanager und sein Personal immer die aktuellen Daten erhalten, ohne dies manuell über Funk übermitteln zu müssen.

Für den technischen Hintergrund sind folgende Funktionen enthalten:
1. Abruf über Github über die URL: https://henri1107.github.io/callroom/
2. Installierbare Web App. Dadurch muss die App nicht im Browser ausgeführt werden, sondern macht den anschein einer nativen App.
3. Responsive Design: Das Design wurde mithilfe eines Grids für die Formate Smartphone, Tablet und PC ausgelegt.
4. Anbindung an ein Backend-System (Google Firebase) damit mehrere Geräte auf der selben Datengrundlage arbeiten.
5. Real-Time synchronisation, damit alle Geräte immer auf dem gleichen aktuellen Stand sind (auch ohne manuellen Refresh).
6. Offlinefähig mittels Service Worker
7. Single Page Application: Für einfache App-Like Navigation und schnelle Antwortzeiten egal auf welchem Endgerät.
8. Anmeldung mittels Benutzer- und Berechtigungsmanagement

Für die User Experience sind folgende Funktionen enthalten:
1. Home-Seite wo der User sich an- und abmelden kann.
2. Einstellungen für den Modus (Einzel - 64er KO oder Team 16er KO), die Bahnfahrbe und -namen, sowie die Erstellung eines neuen Turniers
3. Übersicht für die Offiziellen des internationelen Fechtverbands (Read-Only-Ansicht, da diese nicht aktiv in das Turniergeschehen eingreifen, sondern als Kontrollgremium dienen)
4. Übersicht der fehlenden Fechter für den Hallensprecher
5. Tableau / Turnierbaum indem die Sieger dokumentiert und die nächsten Paarungen angezeigt werden.
6. Tableau eintragen für das erstmalige Eintragen der Fechter (die Fechter werden aus der XML, der Meldungen gezogen)
7. Callroom-Übersicht mit dem Anzeigen des nächsten Durchgangs mit den Infos:
- Wer auf welcher Bahn ficht
- Welcher Fechter links und welcher rechts steht (kann geändert und im Anschluss bestätigt/gesperrt werden)
- Wie viel Zeit noch bis zum Einlauf besteht
- Eintragung, welche Fechter anwesend sind und in welchem Status sie sich befinden (abwesend, anwedend, kontrolliert)
- Anzeige, wenn der Callroom fertig ist
8. Eintragungsmöglichkeit für den Turnierzeitplan, damit die Timer-Zeiten passen
9. Verbindungsmöglichketit über QR-Code und manuelle Eintragen der Event-ID, damit alle auf der gleichen Datengrundlage arbeiten
10. Benutzer- und Berechtigungsmanagement

Die Reiter Einstellungen, Tableau eintragen, Zeitplan und Berechtigungen werden nur dem Turnieradministrator vergeben.
Die anderen Reiter werden je nach Person und Berechtigungen vergeben.