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
- Interview-Frage gestellt: Unterschied `print("Hallo")` vs. `print(Hallo)`.
- Schritt 2a gestellt: Variablen in `pipeline/grundlagen.py`
  (`titel`, `anzahl`, `print("Meldungen:", anzahl)`). Wartet auf Ausgabe.

## Gelernte Konzepte

- Terminal: Befehle tippen statt klicken; Option `--version`
- Git-Begriffe: Repository, klonen (lokale Kopie), pushen (hochschicken)
- VS Code: Befehlspalette ⌘⇧P, eingeschränkter Modus
- Python ausführen: `python3 pfad/datei.py`; Pfeil ↑ holt letzten Befehl
- `print(...)` als Funktion, Strings in Anführungszeichen, Ablauf von oben
  nach unten

## Offene Punkte / Notizen

- Eine News-Ansicht auf der Website gibt es noch nicht; das JSON-Format
  wird in Schritt 5 festgelegt.
