# Lernlog: Nachrichten-Pipeline mit Python

Ziel: Ein Python-Skript holt Meldungen aus einigen RSS-Feeds, bereitet sie
auf und speichert die wichtigsten als `data/news.json`. Später läuft es
täglich über GitHub Actions; die Website zeigt die Datei in einer
News-Ansicht. Verwendet werden nur Schlagzeile, Anreißertext und Link.

Arbeitsweise: siehe Abschnitt „Nachrichten-Pipeline“ in `CLAUDE.md`.

## Fahrplan

1. [ ] Python auf dem Mac prüfen/einrichten, erstes „Hallo Welt“
2. [ ] Grundlagen: Variablen, Listen, Schleifen, Funktionen
3. [ ] Einen RSS-Feed abrufen, Schlagzeilen ausgeben
4. [ ] Mehrere Feeds abrufen, Meldungen in einer Liste sammeln
5. [ ] Einheitliches Format, als JSON speichern (Format der Website)
6. [ ] Wichtigste Meldungen auswählen (erst die neuesten, später schlauer)
7. [ ] Täglich über GitHub Actions ausführen

## Stand

- **2026-10-27:** Start. Schritt 1 erklärt: Terminal öffnen,
  `python3 --version` prüfen, erste Datei `pipeline/hallo.py`.
  Wartet auf die Ausgabe des Nutzers.

## Gelernte Konzepte

(noch keine)

## Offene Punkte / Notizen

- Eine News-Ansicht auf der Website gibt es noch nicht; das JSON-Format
  wird in Schritt 5 festgelegt.
