# Datenbank-Lernlog

Lernprojekt: Die Daten der Website sollen von `localStorage` in eine
Oracle Autonomous Database (Always Free, Transaction Processing, Region
Frankfurt) umziehen. Zugriff aktuell über Database Actions / SQL-Editor.

## Ausgangslage

- Datenbank angelegt, Verbindung über Database Actions funktioniert.
- Alle Daten liegen bisher im Browser (`localStorage`).
- Für "Zu erledigen" laufen alle Lese- und Schreibzugriffe über
  `js/todo-store.js` – das ist später die einzige Stelle im Frontend, die
  auf die Datenbank umgestellt werden muss.

## Fahrplan

0. Orientierung in der OCI-Konsole und in Database Actions (ohne etwas anzulegen)
1. Datenmodell für "Zu erledigen" auf Papier entwerfen
2. Eigenen Datenbank-Benutzer (Schema) für die App anlegen, nicht ADMIN verwenden
3. Tabelle(n) per DDL anlegen
4. Testdaten einfügen und abfragen
5. REST-Schnittstelle über ORDS bereitstellen
6. Frontend (`js/todo-store.js`) auf die REST-Schnittstelle umstellen

## Schritt 0: Orientierung

**Status:** erledigt – Datenbankversion: Oracle AI Database 26ai (BOOLEAN-Datentyp verfügbar)

## Schritt 1: Datenmodell für "Zu erledigen"

**Status:** offen – Aufgabe gestellt (2026-10-16)

**Analyse von `js/todo-store.js`:** Eine Aufgabe hat `id`, `titel`
(Pflicht), `beschreibung` (optional), `faelligkeit` (entweder Abgabe mit
Datum + optionaler Uhrzeit oder wöchentlich mit Wochentag 0–6 + optionaler
Uhrzeit), `erledigt`, `erledigtAm` und `erstellt`.

**Aufgabe:** Tabellenmodell entwerfen (Tabellen, Spalten, Datentypen,
NOT NULL, Primärschlüssel, Constraints) und Entscheidungen begründen.

**Entwurf 1 (Data Dictionary in Excel):** ID VARCHAR2 PK, Titel VARCHAR2,
Beschreibung VARCHAR2 (nullable), Fälligkeit DATE, Erledigt Boolean,
ErledigtAm DATE (nullable), Erstellt DATE. NOT NULL überall richtig gesetzt.

Feedback zu Entwurf 1:
- Fälligkeit als ein DATE kann wöchentliche Aufgaben ("jeden Donnerstag")
  und die Art der Fälligkeit nicht abbilden. Muss überarbeitet werden.
- Längen für VARCHAR2 fehlen.
- Spaltennamen: keine Umlaute, Oracle-Konvention snake_case (Großschreibung
  ohne Anführungszeichen wird ignoriert).
- Offen: DATE vs. TIMESTAMP.
- Konzept erklärt: atomare Werte / 1. Normalform (Fälligkeit nicht als zusammengesetzten Text speichern).

**Zerlegungs-Übung (Fälligkeit):** Fälligkeit in vier Spalten aufgeteilt:
art (VARCHAR2), datum (DATE), zeit (TIMESTAMP), wochentag (Integer).
Selbst erkannt: datum ist nur bei Abgaben Pflicht, wochentag nur bei
wöchentlichen Aufgaben.

Feedback:
- Zerlegung richtig, Abhängigkeit von `art` richtig erkannt.
- NOT NULL gilt pro Spalte, nicht pro Zeile → bedingte Pflichtfelder
  brauchen CHECK-Constraints. Konzept erklärt.
- zeit ist laut Code bei beiden Arten optional (nicht Pflicht bei Abgabe).
- Offen: TIMESTAMP für reine Uhrzeit hinterfragen; INTEGER vs. NUMBER(1).

**Entwurf 2 (Data Dictionary):** id VARCHAR2(20) PK, titel VARCHAR2(30),
beschreibung VARCHAR2(100), faelligkeit_art VARCHAR2(20) NOT NULL,
faelligkeit_datum DATE, faelligkeit_zeit TIMESTAMP WITH TIME ZONE,
faelligkeit_wochentag NUMBER(6), erledigt BOOLEAN, erledigt_am DATE,
erstellt DATE. Bedingte Regeln (datum bei Abgabe, wochentag bei
wöchentlich) als Constraint-Text notiert.

Feedback zu Entwurf 2:
- NOT NULL jetzt pro Spalte richtig; bedingte Pflichtfelder richtig erkannt.
- Hinweis gegeben (2. Versuch): Uhrzeit ist laut App bei beiden Arten
  optional; TIMESTAMP WITH TIME ZONE passt nicht zu einer reinen
  Ortszeit-Uhrzeit (Optionen genannt: Text HH:MI, Minuten als Zahl, INTERVAL).
- Hinweis gegeben (2. Versuch): NUMBER(6) erlaubt 6 Stellen, Wochentag
  braucht eine Stelle plus Wertebereich 0–6.
- Fehlende Regeln: erlaubte Werte für faelligkeit_art (Schreibweise wie im
  Code: "woechentlich"), Gegenrichtung (Abgabe hat keinen Wochentag usw.),
  erledigt/erledigt_am.
- Längen: titel 30 knapp; Frontend hat kein maxlength → Länge muss auch im
  Frontend begrenzt werden. Stichwort BYTE vs. CHAR (Umlaute in UTF-8).
- Weiter offen: DATE vs. TIMESTAMP für erstellt/erledigt_am, Begründungen.

**Entscheidungen:**
- Fälligkeit wird in vier Spalten zerlegt (1. Normalform), mit Präfix:
  `faelligkeit_art`, `faelligkeit_datum`, `faelligkeit_zeit`,
  `faelligkeit_wochentag`. Begründung: Die Namen sind ohne Kontext
  eindeutig und grenzen sich von `erstellt`/`erledigt_am` ab; längere Namen
  werden dafür in Kauf genommen.

**Interview-Fragen und Bewertung:** _folgen nach dem Schritt_
