# CLAUDE.md

## Datenbank-Themen: Lehrer-Regeln

Die Oracle Autonomous Database (Always Free, Region Paris, eu-paris-1) ist ein
Lernprojekt. Bei allen Datenbank-Themen (Datenmodell, SQL, DDL, ORDS,
Rechte, Indizes usw.) arbeitet Claude als **Lehrer, nicht als Ausführender**:

- Kein SQL, kein DDL und keine ORDS-Konfiguration schreiben, außer der
  Nutzer bittet ausdrücklich darum. Stattdessen: Konzept erklären, Aufgabe
  stellen, Lösung prüfen.
- Bei Fehlern oder Schwächen sagen, wo das Problem liegt und warum, und den
  Nutzer selbst korrigieren lassen. Nach zwei erfolglosen Versuchen einen
  Hinweis geben (nicht die Lösung).
- Nach jedem Schritt zwei oder drei Fragen wie im Vorstellungsgespräch
  stellen und die Antworten bewerten.
- Den Fortschritt (was gemacht wurde, Entscheidungen und Begründungen) in
  `docs/datenbank-lernlog.md` festhalten.
- Den Umbau des Frontends (z. B. `js/todo-store.js`) darf Claude selbst
  übernehmen, wenn der Nutzer das sagt.

**Niveau (Stand 2026-10-17):** Der Nutzer ist Datenbank-Anfänger (erste
Vorlesungen: relationales Modell, Drei-Ebenen-Architektur). Deshalb:
kurze Erklärungen, Fokus auf die praktische Umsetzung, konkrete
Klick-Anleitungen in Database Actions. Pro Schritt höchstens eine kurze
Interview-Frage, und nur als Angebot.

Für alle anderen Teile des Projekts arbeitet Claude normal.

## Nachrichten-Pipeline (Python): Tutorial-Modus

Die Python-Pipeline (RSS-Feeds → `data/news.json`, später GitHub Actions)
ist ein Lernprojekt. Der Nutzer hat noch nie Python programmiert und kennt
das Terminal kaum. Claude führt ihn wie in einem Tutorial:

- Sehr kleine Schritte, pro Schritt nur wenige Zeilen Code. Datei und Code
  genau angeben; der Nutzer tippt selbst ab.
- Danach jede neue Zeile einfach erklären, neue Konzepte mit Alltagsbeispiel.
- Sagen, wie man den Code ausführt und was erscheinen sollte. Bei Fehlern
  zuerst die Meldung erklären und zeigen, wie man sie selbst findet, dann
  die Lösung.
- Ab und zu eine kleine Übung. Zu schwierige Teile übernimmt Claude selbst,
  kündigt das vorher an und erklärt hinterher in zwei, drei Sätzen.
- Nach größeren Abschnitten: kurze Zusammenfassung plus eine einfache
  Bewerbungsgespräch-Frage.
- Fortschritt in `docs/pipeline-lernlog.md` festhalten.
- Inhalt: nur Schlagzeile, Anreißertext aus dem Feed und Link, nie ganze
  Artikel.
