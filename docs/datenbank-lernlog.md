# Datenbank-Lernlog

Lernprojekt: Die Daten der Website sollen von `localStorage` in eine
Oracle Autonomous Database (Always Free, Transaction Processing, Region
Paris `eu-paris-1` – laut REST-URL; ursprünglich als Frankfurt notiert) umziehen. Zugriff aktuell über Database Actions / SQL-Editor.

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

**Status:** abgeschlossen (2026-10-17)

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
   Musterantwort auf Wunsch von Claude formuliert (1. Normalform, Typprüfung,
   Abfragen, Constraints).
2. und 3. auf später verschoben.

**Kurswechsel (2026-10-17):** Auf Wunsch des Nutzers weniger Theorie und
Interview-Training, mehr praktische Umsetzung. Schritt 1 mit dem Excel-Modell
abgeschlossen. Regeln in `CLAUDE.md` entsprechend angepasst.

## Schritt 2: Eigener Datenbank-Benutzer

**Status:** erledigt (2026-10-17) – Benutzer im claude.ai-Chat angelegt
(Benutzername `NTB_APP`, Nutzungsgruppe LOW, Web Access an). Anmeldung als neuer Benutzer klappt;
im Schema liegt nur `DBTOOLS$EXECUTION_HISTORY` (legt Database Actions
selbst an).

**Warum:** ADMIN hat alle Rechte; die App bekommt einen eigenen Benutzer
(= eigenes Schema) mit nur den nötigen Rechten (Prinzip der minimalen Rechte).

## Schritt 3: Tabelle anlegen

**Status:** erledigt (2026-10-17) – Tabelle AUFGABE erfolgreich angelegt.
Weg A gewählt: Nutzer schreibt `CREATE TABLE` selbst; Aufbau an einem
Fremdbeispiel (Tabelle `kontakt`) erklärt.

Der fertige Befehl liegt in `db/01_aufgabe.sql` (Schema unter
Versionskontrolle).

Gelernt / korrigiert unterwegs:
- `BETWEEN 0-6` ist eine Rechnung (−6) → richtig `BETWEEN 0 AND 6`.
- "Genau dann"-Regel als zwei Fälle mit `OR`; BOOLEAN mit `TRUE`/`FALSE`
  ohne Anführungszeichen vergleichen.
- Regulärer Ausdruck aus `istZeit()` mit `REGEXP_LIKE` übernommen
  (ohne `/…/`, in einfachen Anführungszeichen).
- Falscher Spaltenname → ORA-00904 "invalid identifier".
- Kein Komma nach dem letzten Constraint.

## Schritt 4: Testdaten einfügen und Regeln testen

**Status:** erledigt (2026-10-18). Ablauf: INSERT-Aufbau an der
Fremdtabelle `kontakt` erklärt, Literale für DATE/TIMESTAMP/BOOLEAN/NULL,
SELECT, COMMIT/ROLLBACK, Run Statement vs. Run Script.

Aufgabe: zwei gültige Aufgaben einfügen (eine Abgabe, eine wöchentliche),
mit SELECT prüfen, COMMIT; danach drei absichtlich ungültige Zeilen
einfügen, vorher vorhersagen, welcher Constraint greift.

Fortschritt (2026-10-18):
- `test1` (Abgabe, offen) und `test2` (wöchentlich, Donnerstag = 3,
  erledigt) selbst geschrieben und eingefügt.
- Test Wochentag 7 → `ORA-02290: CHECK-Constraint
  (NTB_APP.AUFGABE_FAELLIGKEIT_WOCHENTAG_CK) verletzt` – Constraint greift.
- Test Wochentag 10 → scheitert schon am Datentyp `NUMBER(1)` (ORA-01438),
  vor dem CHECK – selbst richtig erklärt.
- Abgabe ohne Datum → `AUFGABE_FAELLIGKEIT_DATUM_CK` greift.
- Erledigt ohne erledigt_am → `AUFGABE_ERLEDIGT_AM_CK` greift.
- Uhrzeit '34:00' → `AUFGABE_FAELLIGKEIT_ZEIT_CK` greift.
- Titel NULL → `ORA-01400` (NOT NULL, nennt Schema.Tabelle.Spalte).
- **Lücke gefunden:** Titel `' '` (nur Leerzeichen) wird angenommen –
  `''` dagegen wird zu NULL und abgelehnt. Frontend trimmt, die DB nicht.
  Behoben mit `aufgabe_titel_ck` (`TRIM(titel) IS NOT NULL`) per
  `ALTER TABLE … ADD CONSTRAINT` (Bedingung mit Hilfe von Claude), siehe
  `db/02_aufgabe_titel_ck.sql`. Test mit `' '` → `AUFGABE_TITEL_CK` greift.
- ROLLBACK hat `test5` nicht entfernt: Der SQL-Editor in Database Actions
  schickt jede Ausführung als eigene Anfrage (über REST) und committet sie
  am Ende automatisch. ROLLBACK wirkt nur innerhalb einer Ausführung
  (z. B. mehrere Befehle zusammen mit F5). → Aufräumen per DELETE … WHERE.
- Doppelte ID `test1` → `ORA-00001: Unique Constraint (NTB_APP.AUFGABE_PK)`.
- Gelernt: Oracle meldet nur den ersten Fehler; Reihenfolge zwischen
  CHECKs ist nicht festgelegt → pro Test nur einen Fehler einbauen.

Übersicht der Fehlermeldungen:

| Nummer | Bedeutung |
|---|---|
| ORA-02290 | CHECK-Constraint verletzt (nennt den Constraint-Namen) |
| ORA-01400 | NULL in NOT-NULL-Spalte (nennt Schema.Tabelle.Spalte) |
| ORA-00001 | Primärschlüssel/Unique verletzt (doppelter Wert) |
| ORA-01438 | Zahl zu groß für den Datentyp |
| ORA-02293 | neuer Constraint passt nicht zu vorhandenen Daten |
| ORA-00904 | ungültiger Bezeichner (z. B. falscher Spaltenname) |

Interview-Frage (optional): *Warum zusätzlich ein Constraint, wenn
JavaScript schon prüft?* – Antwort mit eigenem Leerzeichen-Experiment
begründet. Bewertung 3/5: gutes konkretes Beispiel; "redundant" ist der
falsche Begriff (gemeint: ungültige/inkonsistente Zeile); es fehlte, dass
Daten auch an der App vorbei in die DB kommen (SQL-Editor, andere Clients,
Fehler im JS, manipulierte Browser-Anfragen) – die DB als letzte
Verteidigungslinie.

Testdaten `test1` und `test2` bleiben für Schritt 5 in der Tabelle.

## Schritt 5: REST-Schnittstelle (ORDS)

**Status:** begonnen (2026-10-18).

Plan:
- 5a: AutoREST für Tabelle AUFGABE per Klick aktivieren und GET im Browser
  testen. Vorübergehend ohne Anmeldung, nur mit Testdaten.
- 5b: Absichern, bevor echte Daten oder das Frontend angeschlossen werden
  (die Website ist öffentlich auf GitHub Pages – ohne Schutz könnte jeder
  mit der URL Aufgaben lesen, ändern und löschen). Außerdem CORS klären.
- 5c: Frontend `js/todo-store.js` auf die REST-Schnittstelle umstellen
  (übernimmt Claude).

Fortschritt 5a: AutoREST für AUFGABE aktiviert (ohne Anmeldung, nur
Testdaten). URL-Schema: `https://<host>/ords/ntb_app/aufgabe/`. GET im
Browser liefert JSON. ⚠️ Absicherung (5b) steht noch aus.

So liefert ORDS die Datentypen (wichtig für 5c):
- DATE → `"2026-10-20T00:00:00Z"` (im Frontend nur die ersten 10 Zeichen
  nehmen, nicht über `new Date()` umrechnen – sonst Zeitzonen-Verschiebung)
- TIMESTAMP WITH TIME ZONE → ISO-Zeitpunkt in UTC (`…Z`), wie in der App
- BOOLEAN → `true`/`false`, NUMBER → Zahl, leere Spalten → `null`
- Liste unter `items`, Paginierung über `limit` (25), `hasMore`, `offset`

5b – Plan zur Absicherung:
1. "Require Authentication" für AutoREST einschalten → ohne Anmeldung 401.
2. OAuth-Client (Client Credentials) in Database Actions anlegen und der
   AutoREST-Rolle zuordnen. Client-ID/Secret kommen NICHT in den Code,
   sondern werden in den Einstellungen der Website auf den eigenen Geräten
   eingetragen (Website ist öffentlich).

Fortschritt 5b:
- AutoREST mit "Authentifizierung erforderlich" neu aktiviert (Deaktivieren
  → Aktivieren). Im privaten Fenster: 401 Unauthorized ✅.
- Gelernt: Im normalen Fenster kamen trotzdem Daten, weil der Browser das
  Anmelde-Cookie von Database Actions mitschickt → Sicherheit immer im
  privaten Fenster bzw. ohne Anmeldung testen.
- OAuth-Client `NTBHUB_Website` angelegt (CLIENT_CRED). Secret nur im
  Passwort-Manager, nie im Repo/Chat.
- Token-Test per curl: `POST …/ords/ntb_app/oauth/token` mit Client-ID und
  Secret → 200 + access_token (gültig 3600 s); `GET …/aufgabe/` mit
  `Authorization: Bearer …` → 200 + test1/test2 ✅ (Rolle stimmt).
- Gelernt: `curl -s` verschluckt Fehler, `-i` zeigt den HTTP-Status;
  "Could not resolve host: https" = `https://` doppelt in der URL.
- Zulässiger Ursprung (CORS) `https://nikobinkul21.github.io` – vom Nutzer
  noch zu bestätigen.

**Status 5b:** erledigt (2026-10-18).

### 5c: Frontend umgebaut (Claude, 2026-10-18)

- Neu: `js/todo-db.js` – Token holen (Client Credentials), GET (seitenweise),
  POST, PUT, DELETE; Übersetzung Aufgabe ↔ Tabellenzeile.
- `js/todo-store.js`: zwei Modi. Ohne Zugangsdaten wie bisher localStorage.
  Mit Zugangsdaten: Lesen aus einer lokalen Kopie der DB-Daten, jede
  Änderung geht nacheinander (Warteschlange) an die DB; bei Fehler wird der
  Stand der DB neu geladen. Länge von Titel/Beschreibung wie in der Tabelle
  (50/100) im Formular geprüft.
- `js/todo.js`: Statuszeile ("Lädt …", "Gespeichert in der Datenbank",
  Fehler mit ORA-Nummer), lädt beim Öffnen und beim Zurückkehren zum Tab neu.
- Einstellungen: Bereich "Datenbank für Zu erledigen" – Client-ID/Secret
  (nur im Browser gespeichert), Verbinden (testet sofort), Trennen,
  "Lokale Aufgaben übertragen" (überspringt vorhandene IDs, lokale Daten
  bleiben).
- Getestet im Browser gegen eine simulierte ORDS-Schnittstelle: falsches
  Secret, Verbinden, Anzeigen, Erledigt (PUT), Neu (POST), Löschen (DELETE),
  Übertragen, abgelehnte Änderung → Fehlermeldung und Rücksetzen.
- Übernommen in den veröffentlichten Branch (nikobinkul21/nikobinkul21.github.io#1).
- Echter Test auf der Website erfolgreich (2026-10-18): Verbinden auf dem Mac
  klappt, Aufgaben kommen aus der Datenbank.
- Weitere Geräte (Handy): dieselbe Client-ID und dasselbe Secret in den
  Einstellungen eintragen – Übertragung am besten über die geteilte
  Zwischenablage oder einen Passwort-Manager, nicht per Messenger/E-Mail.

**Status Schritt 5:** abgeschlossen.

## Ausblick (Stand 2026-10-18)

Offene Ideen für die nächsten Sitzungen:
- Optional: Während "Zu erledigen" sichtbar ist, alle 30 Sekunden neu aus der
  Datenbank laden (heute: beim Öffnen, Neuladen und Zurückkehren zum Tab).
- Mehrere Nutzer: ein gemeinsamer Client-Secret ist dafür ungeeignet (alle
  wären dieselbe Identität). Nötig wären:
  1. Login pro Person (z. B. "Mit Google anmelden", Token als JWT; ORDS kann
     JWTs prüfen),
  2. Datenmodell: Tabelle `benutzer` und Fremdschlüssel `aufgabe.benutzer_id`
     (1:n-Beziehung),
  3. Autorisierung in der Datenbank: eigene ORDS-REST-Handler mit
     `WHERE benutzer = angemeldeter Nutzer` statt AutoREST,
  dazu Datenschutz (DSGVO). Guter Einstieg: Baustein 2 (Fremdschlüssel).

---

# Bereich 2: Stundenplan/Termine (ab 2026-10-26)

Ziel: Modell mit mehreren Tabellen, Zeiträume, Abfragen, Serien auflösen,
View und Index. Lehrer-Regeln gelten wieder vollständig, inklusive
Interview-Fragen nach jedem Schritt (auf Wunsch des Nutzers).

Fahrplan:
1. Datenmodell mit mehreren Tabellen und Fremdschlüsseln (Normalisierung)
2. Datentypen und Constraints für Zeiträume und Serien
3. Testdaten (Serien mit Enddatum, einmalige und überlappende Termine)
4. Abfragen: Woche, Überschneidungen, Anzahl pro Fach
5. Serien per Abfrage in einzelne Vorkommen auflösen
6. View für die aktuelle Woche, Index, Ausführungsplan

## Analyse von `js/events-store.js`

Ein Eintrag: `id`, `titel` (Pflicht), `art` ("termin" | "vorlesung"),
`datum` (erster bzw. einziger Tag), `ganztaegig`, `start`/`ende` (HH:MM, nur
wenn nicht ganztägig, Ende > Start), `ort`, `notiz` (optional),
`wiederholung` ("keine" | "woechentlich"), `wiederholungBis` (optional,
nicht vor `datum`). Kalender und Stundenplan lesen beide daraus.

Unterschiede zu "Zu erledigen":
- Zeitraum (Start und Ende) statt eines Fälligkeitszeitpunkts; ganztägig
  als Sonderfall.
- Serien mit optionalem Enddatum; der Wochentag wird aus `datum`
  abgeleitet und nicht gespeichert.
- Kein Zustand (kein "erledigt") – Einträge ändern sich selten.
- Hauptzugriff ist "alles in einem Zeitraum" → Serien müssen aufgelöst
  werden (Schritt 5), Zeitraum-Abfragen brauchen einen Index (Schritt 6).
- Wiederkehrende Texte (Fachname, Ort) in vielen Einträgen →
  Kandidaten für eigene Tabellen (Schritt 1).

## Schritt 1: Datenmodell mit mehreren Tabellen

**Status:** siehe unten.

Teil A (was auslagern?), Stand 2026-10-26:
- **Fach:** ja. Begründung zuerst nur "keine Doppelungen" (richtig); die
  Löschanomalie war falsch verstanden (es ging nicht um andere Termine,
  sondern um das Wissen über das Fach). Mit konkretem Beispiel
  (Dozentin/Farbe in jeder Zeile) erklärt.
- **Ort:** nein – nur ein Raumname ohne weitere Eigenschaften.
- **Wiederholung:** keine eigene Tabelle – "wöchentlich" + Enddatum bleiben
  im Termin; leere Felder bei Einzelterminen werden in Kauf genommen.
  (Eigene Serien-Tabelle erst nötig, wenn z. B. Ausnahmen wie "fällt an
  Feiertag aus" gespeichert werden sollen.)
- **Art:** eigene Tabelle – neue Arten (Arzttermin, Arbeit, Vorlesung,
  Übung, …) sollen per INSERT ergänzt werden können, ohne die
  Tabellendefinition zu ändern.

- **Schlüssel von ART:** kurzer Code (`vorlesung`, `arzt`, …) statt Name
  oder Zahl – stabil und trotzdem lesbar. Konzept natürlicher vs.
  künstlicher Schlüssel erklärt; Vorteil (Umbenennen ändert nur den
  Anzeigenamen, nicht die Verweise) noch einmal Schritt für Schritt erklärt.

Teil B – Tabellen:
- **ART:** `id` VARCHAR2 NOT NULL PK (kurzer Code), `name` VARCHAR2 NOT NULL
  (Anzeigename). Ohne Farbe. ✅ (Längen und UNIQUE auf `name` → Schritt 2)
  Begründung in eigenen Worten: Umbenennen ändert nur eine Zeile in ART,
  der Code bleibt stabil, weil es keinen Grund gibt, ihn zu ändern. ✅
- **FACH:** `id` NUMBER NOT NULL PK (fortlaufend, soll von Oracle vergeben
  werden → Identity-Spalte in Schritt 2), `titel` VARCHAR2 NOT NULL. ✅
- **TERMIN (Vorüberlegung):** `titel` bleibt in TERMIN und ist immer
  Pflicht (Variante A) – Termine ohne Fach (z. B. Zahnarzt) brauchen einen
  Titel; `fach_id` darf leer sein.
- **TERMIN (Entwurf):** `id` VARCHAR2 PK, `titel` VARCHAR2 NOT NULL,
  `art_id` VARCHAR2 NOT NULL FK → ART, `fach_id` NUMBER FK → FACH (optional),
  `datum` DATE NOT NULL, `ganztaegig` BOOLEAN NOT NULL, `start`, `ende`,
  `ort`, `notiz`, `wiederholung` BOOLEAN, `wiederholung_bis`.
  Datentypen der FKs passen zu den Zieltabellen ✅. Korrigiert: `fach_id`
  optional, `wiederholung_bis` in snake_case, `wiederholung` BOOLEAN NOT NULL ✅. Typen für start/ende/wiederholung_bis →
  Schritt 2 (`DATE WITH TIMESTAMP` gibt es nicht).

Teil C – Beziehungen:
- ART 1 ──< n TERMIN (Pflicht), FACH 1 ──< n TERMIN (optional).
- Löschen eines Fachs: **mitlöschen** (ON DELETE CASCADE) – nach dem
  Semester mit einem Schritt aufräumen. Risiko besprochen: versehentliches
  Löschen nimmt alle Termine (auch z. B. eine Klausur) unwiderruflich mit.

**Status Schritt 1:** abgeschlossen (2026-10-26), Interview-Fragen gestellt.

Interview-Fragen Schritt 1:
1. *Warum Fach ausgelagert, Ort nicht?* – Bewertung 4/5: beide Hälften
   begründet, Fremdschlüssel genannt. Verbesserung: "eleganter" durch den
   konkreten Nutzen ersetzen (keine Anomalien: einmal umbenennen, Fach bleibt
   beim Löschen der Termine erhalten, Zählen pro Fach zuverlässig); beim Ort
   ist das stärkere Argument "keine eigenen Eigenschaften", nicht "jeder
   Raum ist anders" (eine Serie nutzt denselben Raum jede Woche).
2. *Fremdschlüssel / art_id = 'sport'?* – offen

Hinweis an Claude: Nutzer wünscht kleinere Häppchen – eine Frage bzw.
Aufgabe nach der anderen.
