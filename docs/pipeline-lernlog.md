# Lernlog: Nachrichten-Pipeline mit Python

Ziel: Ein Python-Skript holt Meldungen aus einigen RSS-Feeds, bereitet sie
auf und speichert die wichtigsten als `data/news.json`. Später läuft es
täglich über GitHub Actions; die Website zeigt die Datei in einer
News-Ansicht. Verwendet werden nur Schlagzeile, Anreißertext und Link.

Arbeitsweise: siehe Abschnitt „Nachrichten-Pipeline“ in `CLAUDE.md`.

## Fahrplan

1. [x] Python auf dem Mac prüfen/einrichten, erstes „Hallo Welt“
2. [ ] Grundlagen: Variablen, Listen, Schleifen, Funktionen
3. [ ] Einen RSS-Feed abrufen, Schlagzeilen ausgeben
4. [ ] Mehrere Feeds abrufen, Meldungen in einer Liste sammeln
5. [ ] Einheitliches Format, als JSON speichern (Format der Website)
6. [ ] Wichtigste Meldungen auswählen (erst die neuesten, später schlauer)
7. [ ] Täglich über GitHub Actions ausführen

## Stand

- **2026-10-27:** Start. Schritt 1 erklärt: Terminal öffnen,
  `python3 --version` geprüft: **Python 3.9.6** (die von Apple
  mitgelieferte Version). Reicht zum Lernen; ein Update auf eine neuere
  Version ist später möglich, aber nicht nötig.
- Bisher hat der Nutzer Dateien nur auf github.com bearbeitet, das
  Repository lag noch nicht auf dem Mac.
- VS Code installiert, Repository `nikobinkul21/nikobinkul21.github.io`
  (früher NTBhub) nach `Dokumente` geklont. Stolpersteine: „Restricted
  Mode“ (Ordner vertrauen) und „Initialize Repository“ (falscher Ordner
  offen). Gelöst über Befehlspalette ⌘⇧P → `Git: Clone`.
- Schritt 1d erledigt: `pipeline/hallo.py` mit drei `print`-Zeilen läuft
  (`python3 pipeline/hallo.py` im VS-Code-Terminal). Übung (eigener Name)
  gelöst. **Schritt 1 abgeschlossen.**
- Interview-Frage `print("Hallo")` vs. `print(Hallo)`: richtig beantwortet
  (String vs. Verweis auf nicht vorhandene Variable). Ergänzt: Fehlername
  `NameError`.
- Schritt 2a erledigt: Variablen in `pipeline/grundlagen.py`, Übung
  (3 → 5) gelöst.
- Schritt 2b erledigt: Listen. Übung richtig: letzter Eintrag ist `[2]`,
  `[3]` gibt `IndexError`, weil es keinen vierten Eintrag gibt.
- Schritt 2c erledigt: Kommentare mit `#`, `for`-Schleife. Übung richtig:
  eingerücktes `print("Fertig!")` erscheint nach jeder Schlagzeile, weil
  es dann zur Schleife gehört.
- **Pause.** Die Dateien `pipeline/hallo.py` und `pipeline/grundlagen.py`
  liegen nur lokal auf dem Mac (nicht gepusht).

## Hier geht es weiter

- Kurz wiederholen: Variablen, Listen, Schleifen (Einrückung!).
- Offene Interview-Frage (Angebot): „Was ist eine Schleife, und wozu
  braucht man die Einrückung in Python?“
- Schritt 2d (Teil 1) gestellt: eigene Funktion `zeige_meldung(titel)` mit
  `def`, Parameter, Aufruf; Übung: zweiter Parameter `quelle`.
  Ergebnis noch offen.
- Danach **Schritt 2e: `return`** (Funktion gibt Wert zurück), dann
  Abschluss von Schritt 2 mit Zusammenfassung.

## Gelernte Konzepte

- Terminal: Befehle tippen statt klicken; Option `--version`
- Git-Begriffe: Repository, klonen (lokale Kopie), pushen (hochschicken)
- VS Code: Befehlspalette ⌘⇧P, eingeschränkter Modus
- Python ausführen: `python3 pfad/datei.py`; Pfeil ↑ holt letzten Befehl
- `print(...)` als Funktion, Strings in Anführungszeichen, Ablauf von oben
  nach unten
- Variablen als beschriftete Kisten, `=` als Zuweisung, String vs. `int`,
  `print` mit mehreren Werten per Komma
- Listen `[...]`, Index ab 0 (auch `[-1]` für den letzten), `len()`,
  `IndexError`; Python bricht beim ersten Fehler ab
- Kommentare mit `#`; `for x in liste:` mit Doppelpunkt, Einrückung
  (4 Leerzeichen) bestimmt, was zur Schleife gehört

## Offene Punkte / Notizen

- Eine News-Ansicht auf der Website gibt es noch nicht; das JSON-Format
  wird in Schritt 5 festgelegt.
