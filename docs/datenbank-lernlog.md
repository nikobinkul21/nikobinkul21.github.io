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

**Status:** Modell fertig (2026-10-16), Interview-Fragen laufen

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

**Entwurf 3 (Data Dictionary):** titel VARCHAR2(50); faelligkeit_zeit
VARCHAR2(5) ohne Pflicht-Regel; faelligkeit_wochentag NUMBER(1) mit Regel
"> 6 ungültig"; neue Regel "wenn erledigt = wahr, dann erledigt_am gesetzt".

Feedback zu Entwurf 3:
- Behoben: Uhrzeit optional und als Text HH:MI, Wochentag NUMBER(1),
  Titel länger, Regel zu erledigt_am.
- Noch offen: Formatregel für faelligkeit_zeit; Wochentag auch nicht
  negativ (NUMBER(1) erlaubt -9..9).
- Hinweis gegeben (2. Versuch): erlaubte Werte für faelligkeit_art als
  Werteliste; Gegenrichtung ("Abgabe → wochentag leer" usw.); die Regel zu
  erledigt/erledigt_am gilt in beide Richtungen ("genau dann").
- Weiter offen: BYTE vs. CHAR, DATE vs. TIMESTAMP, Begründungen, einheitliche
  Kleinschreibung der Spaltennamen.

**Entwurf 4 (Data Dictionary):** Spaltennamen einheitlich klein;
faelligkeit_art nur "abgabe"/"woechentlich"; Uhrzeit-Format als regulärer
Ausdruck (aus istZeit()); Wochentag 0–6; datum "genau dann, wenn Abgabe".

Feedback zu Entwurf 4:
- Behoben: Werteliste für art, Bereich 0–6, Formatregel Uhrzeit,
  Kleinschreibung.
- Bei datum mit "genau dann" beide Richtungen abgedeckt – Formulierung
  "gesetzt" statt "Pflicht" ist präziser.
- Noch offen: dasselbe "genau dann" fehlt bei wochentag und erledigt_am.

**Entwurf 5 (Data Dictionary):** Alle "genau dann"-Regeln vollständig
(datum, wochentag, erledigt_am). titel VARCHAR2(50 CHAR). erstellt und
erledigt_am als TIMESTAMP.

Feedback zu Entwurf 5:
- Constraint-Spalte inhaltlich vollständig.
- CHAR nur bei titel – bei beschreibung fehlt es (Umlaute), Entscheidung
  pro Spalte begründen.
- TIMESTAMP ohne Zeitzone: Konvention "immer UTC" muss festgelegt oder
  WITH TIME ZONE gewählt werden.
- Begründungen fehlen noch; Methode erklärt ("Warum das und nicht die
  Alternative?"), Leitfragen pro Zeile gegeben.

**Entwurf 6 = finales Modell (Tabelle `aufgabe`):**

| Spalte | Typ | NOT NULL | Regel |
|---|---|---|---|
| id | VARCHAR2(20) | ja | Primärschlüssel (ID aus dem Browser, `neueId()`) |
| titel | VARCHAR2(50 CHAR) | ja | |
| beschreibung | VARCHAR2(100 CHAR) | nein | |
| faelligkeit_art | VARCHAR2(20 CHAR) | ja | nur "abgabe" oder "woechentlich" |
| faelligkeit_datum | DATE | nein | genau dann gesetzt, wenn art = abgabe |
| faelligkeit_zeit | VARCHAR2(5) | nein | Format HH:MI (00:00–23:59) |
| faelligkeit_wochentag | NUMBER(1) | nein | genau dann gesetzt, wenn art = woechentlich; 0–6 |
| erledigt | BOOLEAN | ja | |
| erledigt_am | TIMESTAMP WITH TIME ZONE | nein | genau dann gesetzt, wenn erledigt = wahr |
| erstellt | TIMESTAMP WITH TIME ZONE | ja | |

**Begründungen pro Spalte** (auf Wunsch von Claude formuliert und erklärt,
2026-10-17 – zum Nacharbeiten in eigenen Worten):

| Spalte | Begründung |
|---|---|
| id | Text, weil die ID im Browser von `neueId()` erzeugt wird (≈ 14 Zeichen aus a–z/0–9); 20 mit Puffer. Browser-ID statt Datenbank-Zahl, damit bestehende Daten und Sicherungen ihre IDs behalten. Kein CHAR nötig (nur ASCII). |
| titel | Pflicht, weil die App ohne Titel nicht speichert. 50 CHAR reicht für realistische Titel; CHAR, damit Umlaute als ein Zeichen zählen. |
| beschreibung | Optional, leer = NULL (Oracle speichert '' ohnehin als NULL). 100 CHAR für eine kurze Notiz. |
| faelligkeit_art | Lesbarer Text statt Code-Zahl; Werteliste genau wie im Frontend. 20 mit Puffer für spätere Arten. |
| faelligkeit_datum | DATE, weil nur ein Kalendertag gebraucht wird. Genau-dann-Regel verhindert widersprüchliche Zeilen. |
| faelligkeit_zeit | Text HH:MI, weil die App eine Uhrzeit ohne Datum und Zeitzone speichert. Leer statt 23:59, damit "keine Uhrzeit" unterscheidbar bleibt. |
| faelligkeit_wochentag | Zahl 0–6 wie im Code (0 = Montag): sprachunabhängig, sortierbar, rechenbar. NUMBER(1) reicht für eine Stelle. |
| erledigt | BOOLEAN (ab 23ai), passt direkt zu true/false in JavaScript. Bewusst redundant zu erledigt_am, Konsistenz über Genau-dann-Regel. |
| erledigt_am | TIMESTAMP WITH TIME ZONE, weil die App UTC mit Millisekunden liefert; DATE kennt weder Bruchteile noch Zeitzone. Grundlage für den Wochenwechsel. |
| erstellt | Wie erledigt_am; immer gesetzt, daher NOT NULL. |

Hinweis für Schritt 3: In Oracle heißt es `WITH TIME ZONE` (zwei Wörter).

**Entscheidungen:**
- CHAR-Längensemantik für Freitext-Spalten (Umlaute zählen als ein
  Zeichen); `id` ohne CHAR, da nur ASCII-Zeichen.
- Zeitpunkte als TIMESTAMP WITH TIME ZONE statt DATE (App liefert UTC mit
  Millisekunden; die Zeitzone wird mitgespeichert).
- `faelligkeit_zeit` als VARCHAR2(5) im Format HH:MI (Ortszeit ohne
  Zeitzone, wie in der App; leer = 23:59).
- Fälligkeit wird in vier Spalten zerlegt (1. Normalform), mit Präfix:
  `faelligkeit_art`, `faelligkeit_datum`, `faelligkeit_zeit`,
  `faelligkeit_wochentag`. Begründung: Die Namen sind ohne Kontext
  eindeutig und grenzen sich von `erstellt`/`erledigt_am` ab; längere Namen
  werden dafür in Kauf genommen.

**Interview-Fragen und Bewertung:**

1. *Warum vier Spalten statt eines Textes?* – Versuch 1: beschreibt die
   vier Bestandteile und die Abhängigkeit von `art` (richtig), begründet
   aber nicht, warum nicht ein Text. Bewertung: 2/5. Fehlt: 1. Normalform /
   atomare Werte, Typprüfung durch die DB, Abfragen/Sortieren, Constraints.
2. *Warum Regeln zusätzlich in der Datenbank?* – offen
3. *VARCHAR2(50 BYTE) vs. (50 CHAR)?* – offen
